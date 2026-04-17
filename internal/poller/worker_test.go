package poller

import (
	"testing"
	"github.com/abhi267266/reddit-lead-finder/internal/reddit"
)

func TestDeduplicateAndFilter(t *testing.T) {
	posts := []reddit.Post{
		{ID: "1", Title: "short", Selftext: "very short"}, // < 30 words
		{ID: "2", Title: "this is a very long title that has many words so we can pass the thirty word filter length requirement easily we need to just type a bit more here to make sure we comfortably cross the thirty word mark by adding some extra words here."}, // > 30 words
		{ID: "2", Title: "same ID duplicate"}, // Duplicate
	}

	result := DeduplicateAndFilter(posts)
	if len(result) != 1 {
		t.Fatalf("Expected 1 post, got %d", len(result))
	}
	if result[0].ID != "2" {
		t.Errorf("Expected post ID 2, got %s", result[0].ID)
	}
}
