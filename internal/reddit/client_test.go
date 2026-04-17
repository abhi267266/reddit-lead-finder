package reddit

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/abhi267266/reddit-lead-finder/internal/config"
)

func TestClient_SearchSubreddit(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/access_token", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "mock_token",
			"expires_in":   3600,
		})
	})

	mux.HandleFunc("/r/testsub/search", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer mock_token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		if r.URL.Query().Get("q") != "keyword" {
			t.Errorf("Expected q=keyword")
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
		RedditUsername:     "testuser",
		RedditClientID:     "dummyid",
		RedditClientSecret: "dummysecret",
	}

	client := NewClient(cfg)
	client.authURL = server.URL + "/api/v1/access_token"
	client.baseURL = server.URL

	posts, err := client.SearchSubreddit(context.Background(), "testsub", "keyword")
	if err != nil {
		t.Fatalf("SearchSubreddit error: %v", err)
	}

	if len(posts) != 1 || posts[0].ID != "123" {
		t.Errorf("Unexpected posts: %+v", posts)
	}
}

func TestClient_GetNewPosts(t *testing.T) {
	mux := http.NewServeMux()
	mux.HandleFunc("/api/v1/access_token", func(w http.ResponseWriter, r *http.Request) {
		json.NewEncoder(w).Encode(map[string]interface{}{
			"access_token": "mock_token",
			"expires_in":   3600,
		})
	})

	mux.HandleFunc("/r/testsub/new", func(w http.ResponseWriter, r *http.Request) {
		if r.Header.Get("Authorization") != "Bearer mock_token" {
			w.WriteHeader(http.StatusUnauthorized)
			return
		}
		resp := ListingResponse{
			Data: ListingData{
				Children: []PostChild{
					{Data: Post{ID: "456", Title: "new post"}},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	cfg := &config.Config{
		RedditUsername:     "testuser",
		RedditClientID:     "dummyid",
		RedditClientSecret: "dummysecret",
	}

	client := NewClient(cfg)
	client.authURL = server.URL + "/api/v1/access_token"
	client.baseURL = server.URL

	posts, err := client.GetNewPosts(context.Background(), "testsub")
	if err != nil {
		t.Fatalf("GetNewPosts error: %v", err)
	}

	if len(posts) != 1 || posts[0].ID != "456" {
		t.Errorf("Unexpected posts: %+v", posts)
	}
}

func TestClient_GuestFallback(t *testing.T) {
	mux := http.NewServeMux()

	mux.HandleFunc("/r/guestsub/new.json", func(w http.ResponseWriter, r *http.Request) {
		// There should be NO Authorization header in guest mode
		if r.Header.Get("Authorization") != "" {
			t.Errorf("Expected no Authorization header in guest mode")
		}
		resp := ListingResponse{
			Data: ListingData{
				Children: []PostChild{
					{Data: Post{ID: "789", Title: "guest post"}},
				},
			},
		}
		json.NewEncoder(w).Encode(resp)
	})

	server := httptest.NewServer(mux)
	defer server.Close()

	cfg := &config.Config{
		RedditUsername: "testuser",
		// NO ClientID or ClientSecret to force fallback
	}

	client := NewClient(cfg)
	client.baseURL = server.URL // Override to local httptest server

	posts, err := client.GetNewPosts(context.Background(), "guestsub")
	if err != nil {
		t.Fatalf("GetNewPosts (Guest) error: %v", err)
	}

	if len(posts) != 1 || posts[0].ID != "789" {
		t.Errorf("Unexpected posts: %+v", posts)
	}
}
