package reddit

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"github.com/abhi267266/reddit-lead-finder/internal/config"
)

type FetchMode int

const (
	ModeOAuth FetchMode = iota
	ModeGuest
)

type Client struct {
	cfg        *config.Config
	httpClient *http.Client
	authURL    string

	tokenMu   sync.RWMutex
	token     string
	tokenExp  time.Time
	baseURL   string
	mode      FetchMode

	rateMu    sync.Mutex
	reqCount  int
}

func NewClient(cfg *config.Config) *Client {
	c := &Client{
		cfg:     cfg,
		baseURL: "https://oauth.reddit.com",
		authURL: "https://www.reddit.com/api/v1/access_token",
		httpClient: &http.Client{
			Timeout: 10 * time.Second,
		},
		mode: ModeOAuth,
	}

	if cfg.RedditClientID == "" || cfg.RedditClientSecret == "" {
		slog.Warn("Reddit OAuth credentials missing, initializing in Guest mode")
		c.mode = ModeGuest
		c.baseURL = "https://www.reddit.com"
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

func (c *Client) getToken(ctx context.Context) (string, error) {
	c.tokenMu.RLock()
	if c.token != "" && time.Now().Add(5*time.Minute).Before(c.tokenExp) {
		tok := c.token
		c.tokenMu.RUnlock()
		return tok, nil
	}
	c.tokenMu.RUnlock()

	c.tokenMu.Lock()
	defer c.tokenMu.Unlock()

	// Double-check
	if c.token != "" && time.Now().Add(5*time.Minute).Before(c.tokenExp) {
		return c.token, nil
	}

	data := url.Values{}
	data.Set("grant_type", "password")
	data.Set("username", c.cfg.RedditUsername)
	data.Set("password", c.cfg.RedditPassword)

	req, err := http.NewRequestWithContext(ctx, "POST", c.authURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", fmt.Errorf("reddit.Client.getToken request create: %w", err)
	}

	req.SetBasicAuth(c.cfg.RedditClientID, c.cfg.RedditClientSecret)
	
	username := c.cfg.RedditUsername
	if username == "" {
		username = "GuestUser"
	}
	req.Header.Set("User-Agent", fmt.Sprintf("RedditLeadFinder/1.0 by %s", username))
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("reddit.Client.getToken request do: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("reddit.Client.getToken returned status %d", resp.StatusCode)
	}

	var res struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&res); err != nil {
		return "", fmt.Errorf("reddit.Client.getToken parse JSON: %w", err)
	}

	c.token = res.AccessToken
	c.tokenExp = time.Now().Add(time.Duration(res.ExpiresIn) * time.Second)

	return c.token, nil
}

func (c *Client) doRequest(ctx context.Context, method, endpoint string, retryAuth bool) (*http.Response, error) {
	c.tokenMu.RLock()
	mode := c.mode
	c.tokenMu.RUnlock()

	c.rateMu.Lock()
	limit := 60
	if mode == ModeGuest {
		limit = 12 // Stricter rate limit for guest mode (approx 1 per 5s)
	}

	for c.reqCount >= limit {
		c.rateMu.Unlock()
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(1 * time.Second): // Simplified spin loop waiting for minute reset
		}
		c.rateMu.Lock()
	}
	c.reqCount++
	c.rateMu.Unlock()

	var token string
	var err error
	if mode == ModeOAuth {
		token, err = c.getToken(ctx)
		if err != nil {
			slog.Warn("Reddit OAuth token fetch failed, falling back to Guest mode", "error", err)
			c.tokenMu.Lock()
			c.mode = ModeGuest
			c.baseURL = "https://www.reddit.com"
			c.tokenMu.Unlock()
			mode = ModeGuest
		}
	}

	if mode == ModeGuest {
		// Convert standard endpoint to .json if in guest mode
		u, err := url.Parse(endpoint)
		if err == nil {
			if strings.HasPrefix(endpoint, "https://oauth.reddit.com") {
				u.Host = "www.reddit.com"
				u.Scheme = "https"
			}
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

	username := c.cfg.RedditUsername
	if username == "" {
		username = "GuestUser"
	}
	req.Header.Set("User-Agent", fmt.Sprintf("RedditLeadFinder/1.0 by %s", username))

	if mode == ModeOAuth {
		req.Header.Set("Authorization", "Bearer "+token)
	}

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
			return c.doRequest(ctx, method, endpoint, false)
		}
	} else if resp.StatusCode == http.StatusUnauthorized && retryAuth {
		resp.Body.Close()
		
		c.tokenMu.Lock()
		if c.mode == ModeOAuth {
			c.token = "" // invalidate 
			c.mode = ModeGuest // auto-switch to guest mode on 401
			c.baseURL = "https://www.reddit.com"
			slog.Warn("Reddit API returned 401 Unauthorized, automatically falling back to Guest mode")
		}
		c.tokenMu.Unlock()

		// Let's rewrite the endpoint from oauth.reddit.com to www.reddit.com for the retry
		if strings.HasPrefix(endpoint, "https://oauth.reddit.com") {
			endpoint = strings.Replace(endpoint, "https://oauth.reddit.com", "https://www.reddit.com", 1)
		}
		return c.doRequest(ctx, method, endpoint, false)
		
	} else if resp.StatusCode >= 500 {
		resp.Body.Close()
		return nil, fmt.Errorf("reddit.Client.doRequest returned status %d", resp.StatusCode)
	} else if resp.StatusCode >= 400 {
		resp.Body.Close()
		return nil, fmt.Errorf("reddit.Client.doRequest returned status %d for %s", resp.StatusCode, endpoint)
	}

	return resp, nil
}

func (c *Client) SearchSubreddit(ctx context.Context, subreddit, keyword string) ([]Post, error) {
	c.tokenMu.RLock()
	baseURL := c.baseURL
	c.tokenMu.RUnlock()

	u, _ := url.Parse(fmt.Sprintf("%s/r/%s/search", baseURL, subreddit))
	q := u.Query()
	q.Set("q", keyword)
	q.Set("sort", "hot")
	q.Set("restrict_sr", "true")
	q.Set("limit", "50")
	q.Set("t", "month")
	u.RawQuery = q.Encode()

	resp, err := c.doRequest(ctx, "GET", u.String(), true)
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
	c.tokenMu.RLock()
	baseURL := c.baseURL
	c.tokenMu.RUnlock()

	u, _ := url.Parse(fmt.Sprintf("%s/r/%s/hot", baseURL, subreddit))
	q := u.Query()
	q.Set("limit", "50")
	u.RawQuery = q.Encode()

	resp, err := c.doRequest(ctx, "GET", u.String(), true)
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
