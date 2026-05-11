package reddit

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/abhi267266/reddit-lead-finder/internal/config"
)

type Client struct {
	cfg        *config.Config
	httpClient *http.Client
	baseURL    string

	rateMu   sync.Mutex
	reqCount int
}

func NewClient(cfg *config.Config) *Client {
	c := &Client{
		cfg:     cfg,
		baseURL: "https://www.reddit.com",
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
	}

	// Reset rate limit counter every minute
	go func() {
		ticker := time.NewTicker(time.Minute)
		for range ticker.C {
			c.rateMu.Lock()
			c.reqCount = 0
			c.rateMu.Unlock()
		}
	}()

	return c
}

func (c *Client) doRequest(ctx context.Context, method, endpoint string) (*http.Response, error) {
	c.rateMu.Lock()
	limit := 12 // Stricter rate limit for guest mode (approx 1 per 5s)

	for c.reqCount >= limit {
		c.rateMu.Unlock()
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(1 * time.Second):
		}
		c.rateMu.Lock()
	}
	c.reqCount++
	c.rateMu.Unlock()

	// Convert standard endpoint to .json if not present
	if !strings.HasSuffix(endpoint, ".json") {
		u, err := url.Parse(endpoint)
		if err == nil {
			if !strings.HasSuffix(u.Path, ".json") {
				u.Path = u.Path + ".json"
			}
			endpoint = u.String()
		}
	}

	req, err := http.NewRequestWithContext(ctx, method, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("reddit.Client.doRequest new request: %w", err)
	}

	userAgent := "RedditLeadFinder/1.0 (GuestMode)"
	if c.cfg.RedditUsername != "" {
		userAgent = fmt.Sprintf("RedditLeadFinder/1.0 by %s", c.cfg.RedditUsername)
	}
	req.Header.Set("User-Agent", userAgent)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("reddit.Client.doRequest http do: %w", err)
	}

	if resp.StatusCode == http.StatusTooManyRequests {
		resp.Body.Close()
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(60 * time.Second):
			return c.doRequest(ctx, method, endpoint)
		}
	} else if resp.StatusCode >= 400 {
		resp.Body.Close()
		return nil, fmt.Errorf("reddit.Client.doRequest returned status %d for %s", resp.StatusCode, endpoint)
	}

	return resp, nil
}

func (c *Client) SearchSubreddit(ctx context.Context, subreddit, keyword string) ([]Post, error) {
	u, _ := url.Parse(fmt.Sprintf("%s/r/%s/search", c.baseURL, subreddit))
	q := u.Query()
	q.Set("q", keyword)
	q.Set("sort", "hot")
	q.Set("restrict_sr", "true")
	q.Set("limit", "50")
	q.Set("t", "month")
	u.RawQuery = q.Encode()

	resp, err := c.doRequest(ctx, "GET", u.String())
	if err != nil {
		return nil, fmt.Errorf("reddit.Client.SearchSubreddit: %w", err)
	}
	defer resp.Body.Close()

	var list ListingResponse
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return nil, fmt.Errorf("reddit.Client.SearchSubreddit json parse: %w", err)
	}

	posts := make([]Post, 0, len(list.Data.Children))
	for _, child := range list.Data.Children {
		posts = append(posts, child.Data)
	}
	return posts, nil
}

func (c *Client) GetHotPosts(ctx context.Context, subreddit string) ([]Post, error) {
	u, _ := url.Parse(fmt.Sprintf("%s/r/%s/hot", c.baseURL, subreddit))
	q := u.Query()
	q.Set("limit", "50")
	u.RawQuery = q.Encode()

	resp, err := c.doRequest(ctx, "GET", u.String())
	if err != nil {
		return nil, fmt.Errorf("reddit.Client.GetHotPosts: %w", err)
	}
	defer resp.Body.Close()

	var list ListingResponse
	if err := json.NewDecoder(resp.Body).Decode(&list); err != nil {
		return nil, fmt.Errorf("reddit.Client.GetHotPosts json parse: %w", err)
	}

	posts := make([]Post, 0, len(list.Data.Children))
	for _, child := range list.Data.Children {
		posts = append(posts, child.Data)
	}
	return posts, nil
}
