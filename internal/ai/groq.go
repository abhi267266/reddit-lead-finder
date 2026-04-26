package ai

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"regexp"
	"strconv"
	"time"

	"github.com/abhi267266/reddit-lead-finder/internal/config"
	"github.com/abhi267266/reddit-lead-finder/internal/models"
)

const groqURL = "https://api.groq.com/openai/v1/chat/completions"

// RateLimitError is returned when Groq exhausts all retries.
// It carries the last known wait duration so callers can store a retry timestamp.
type RateLimitError struct {
	WaitDuration time.Duration
}

func (e *RateLimitError) Error() string {
	return fmt.Sprintf("groq rate limit: retry after %s", e.WaitDuration)
}

type Client struct {
	cfg        *config.Config
	httpClient *http.Client
}

func NewClient(cfg *config.Config) *Client {
	return &Client{
		cfg: cfg,
		httpClient: &http.Client{
			// Long timeout to accommodate waiting inside retries
			Timeout: 5 * time.Minute,
		},
	}
}

type CategorizationResult struct {
	ID       int    `json:"id"`
	Score    int    `json:"score"`
	Category string `json:"category"`
	Summary  string `json:"summary"`
	IsLead   bool   `json:"is_lead"`
}

type groqRequest struct {
	Model          string          `json:"model"`
	Messages       []groqMessage   `json:"messages"`
	ResponseFormat groqResponseFmt `json:"response_format,omitempty"`
	Temperature    float64         `json:"temperature"`
}

type groqMessage struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type groqResponseFmt struct {
	Type string `json:"type"`
}

type groqResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

type batchResponseData struct {
	Results []CategorizationResult `json:"results"`
}

// parseRetryAfter reads how long Groq wants us to wait from response headers,
// falling back to parsing the JSON body, then a safe default.
func parseRetryAfter(resp *http.Response, body []byte) time.Duration {
	const buffer = 500 * time.Millisecond

	// 1. x-ratelimit-reset-tokens: "33.98s" or "1m2.5s"
	if v := resp.Header.Get("x-ratelimit-reset-tokens"); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d + buffer
		}
	}
	// 2. Standard Retry-After header (integer or float seconds)
	if v := resp.Header.Get("retry-after"); v != "" {
		if secs, err := strconv.ParseFloat(v, 64); err == nil {
			return time.Duration(secs*float64(time.Second)) + buffer
		}
	}
	// 3. Regex parse from JSON body: "Please try again in 22.16s"
	re := regexp.MustCompile(`try again in ([\d.]+)s`)
	if m := re.FindSubmatch(body); len(m) == 2 {
		if secs, err := strconv.ParseFloat(string(m[1]), 64); err == nil {
			return time.Duration(secs*float64(time.Second)) + buffer
		}
	}
	// 4. Conservative fallback
	return 10 * time.Second
}

// CategorizeBatch sends a batch of Reddit posts to Groq for categorization.
// It respects Groq's exact retry-after signal on 429s.
// Returns *RateLimitError if all retries are exhausted so callers can store
// the retry timestamp for the UI countdown.
func (c *Client) CategorizeBatch(ctx context.Context, productDescription string, posts []models.RawPost) ([]CategorizationResult, time.Duration, error) {
	if len(posts) == 0 {
		return nil, 0, nil
	}
	if c.cfg.GroqAPIKey == "" {
		return nil, 0, fmt.Errorf("GROQ_API_KEY is missing")
	}

	systemPrompt := `You are a lead qualification engine. Given a list of Reddit posts and a product description,
return ONLY a valid JSON object containing an array of results.
The JSON object must have this exact structure:
{
  "results": [
    {
      "id": integer (the exact ID of the post provided),
      "score": integer 0-100 (buying intent relevance),
      "category": string (one of ["Seeking tool recommendation", "Expressing pain point", "Frustrated with competitor", "Asking for advice", "Research / not buying", "Not relevant"]),
      "summary": string (max 20 words, why this is or isn't a lead),
      "is_lead": boolean
    }
  ]
}

Return nothing else. No explanation. No markdown.`

	userContent := fmt.Sprintf("Product Description: %s\n\nPosts:\n", productDescription)
	for _, p := range posts {
		userContent += fmt.Sprintf("ID: %d\nTitle: %s\nBody: %s\n\n", p.ID, p.Title, p.Body)
	}

	reqBody := groqRequest{
		Model: c.cfg.GroqModel,
		Messages: []groqMessage{
			{Role: "system", Content: systemPrompt},
			{Role: "user", Content: userContent},
		},
		ResponseFormat: groqResponseFmt{Type: "json_object"},
		Temperature:    0.1,
	}

	jsonData, err := json.Marshal(reqBody)
	if err != nil {
		return nil, 0, fmt.Errorf("failed to marshal groq request: %w", err)
	}

	buildReq := func() (*http.Request, error) {
		req, err := http.NewRequestWithContext(ctx, "POST", groqURL, bytes.NewBuffer(jsonData))
		if err != nil {
			return nil, err
		}
		req.Header.Set("Authorization", "Bearer "+c.cfg.GroqAPIKey)
		req.Header.Set("Content-Type", "application/json")
		return req, nil
	}

	req, err := buildReq()
	if err != nil {
		return nil, 0, fmt.Errorf("failed to create request: %w", err)
	}

	const maxRetries = 5
	var lastWait time.Duration
	var resp *http.Response

	for attempt := 0; attempt < maxRetries; attempt++ {
		resp, err = c.httpClient.Do(req)
		if err != nil {
			return nil, 0, fmt.Errorf("failed to execute request: %w", err)
		}

		if resp.StatusCode == http.StatusTooManyRequests {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()

			lastWait = parseRetryAfter(resp, body)
			slog.Warn("groq rate limit, waiting for Groq's retry-after",
				"attempt", attempt+1,
				"wait", lastWait,
			)

			select {
			case <-ctx.Done():
				return nil, lastWait, ctx.Err()
			case <-time.After(lastWait):
			}

			// Rebuild request (body was consumed)
			req, err = buildReq()
			if err != nil {
				return nil, lastWait, fmt.Errorf("failed to rebuild request: %w", err)
			}
			continue
		}

		if resp.StatusCode != http.StatusOK {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			return nil, 0, fmt.Errorf("groq API status %d: %s", resp.StatusCode, string(body))
		}

		break // success
	}

	// Bug fix: if we exited the loop without a successful 200 response
	if resp == nil || resp.StatusCode != http.StatusOK {
		return nil, lastWait, &RateLimitError{WaitDuration: lastWait}
	}
	defer resp.Body.Close()

	var groqResp groqResponse
	if err := json.NewDecoder(resp.Body).Decode(&groqResp); err != nil {
		return nil, 0, fmt.Errorf("failed to decode groq response: %w", err)
	}

	if len(groqResp.Choices) == 0 {
		return nil, 0, fmt.Errorf("groq returned no choices")
	}

	content := groqResp.Choices[0].Message.Content

	var batchData batchResponseData
	if err := json.Unmarshal([]byte(content), &batchData); err != nil {
		return nil, 0, fmt.Errorf("failed to parse JSON from AI: %w\nRaw: %s", err, content)
	}

	slog.Info("groq batch categorized", "posts", len(batchData.Results))
	return batchData.Results, 0, nil
}
