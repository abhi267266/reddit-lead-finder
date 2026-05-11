package reddit

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/abhi267266/reddit-lead-finder/internal/config"
)

func TestClient_SearchSubreddit(t *testing.T) {
	mux := http.NewServeMux()

	mux.HandleFunc("/r/testsub/search.json", func(w http.ResponseWriter, r *http.Request) {
		// Verify parameters
		if r.URL.Query().Get("q") != "keyword" {
			t.Errorf("Expected q=keyword, got %s", r.URL.Query().Get("q"))
		}
		if r.Header.Get("Authorization") != "" {
			t.Errorf("Expected no Authorization header in guest mode")
		}

		resp := ListingResponse{
			Data: ListingData{
				Children: []PostChild{
					{Data: Post{ID: "123", Title: "test post"}},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	cfg := &config.Config{
		RedditUsername: "testuser",
	}

	client := NewClient(cfg)
	client.baseURL = server.URL

	posts, err := client.SearchSubreddit(context.Background(), "testsub", "keyword")
	if err != nil {
		t.Fatalf("SearchSubreddit error: %v", err)
	}

	if len(posts) != 1 || posts[0].ID != "123" {
		t.Errorf("Unexpected posts: %+v", posts)
	}
}

func TestClient_GetHotPosts(t *testing.T) {
	mux := http.NewServeMux()

	mux.HandleFunc("/r/testsub/hot.json", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "" {
			t.Errorf("Expected no Authorization header in guest mode")
		}
		resp := ListingResponse{
			Data: ListingData{
				Children: []PostChild{
					{Data: Post{ID: "456", Title: "hot post"}},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	cfg := &config.Config{
		RedditUsername: "testuser",
	}

	client := NewClient(cfg)
	client.baseURL = server.URL

	posts, err := client.GetHotPosts(context.Background(), "testsub")
	if err != nil {
		t.Fatalf("GetHotPosts error: %v", err)
	}

	if len(posts) != 1 || posts[0].ID != "456" {
		t.Errorf("Unexpected posts: %+v", posts)
	}
}

func TestClient_RateLimit(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		json.NewEncoder(w).Encode(ListingResponse{})
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	cfg := &config.Config{}
	client := NewClient(cfg)
	client.baseURL = server.URL

	// Set count to limit to test the spin loop
	client.reqCount = 12

	ctx, cancel := context.WithTimeout(context.Background(), 100*time.Millisecond)
	defer cancel()

	_, err := client.GetHotPosts(ctx, "any")
	if err == nil || ctx.Err() == nil {
		t.Error("Expected context deadline exceeded error due to rate limit spin loop")
	}
}
