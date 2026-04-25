package poller

import (
	"testing"
	"time"

	"github.com/abhi267266/reddit-lead-finder/internal/reddit"
)

func TestDeduplicateAndFilter(t *testing.T) {
	now := time.Now().Unix()

	posts := []reddit.Post{
		{ID: "1", Title: "low engagement", Score: 1, NumComments: 1, CreatedUTC: float64(now)}, // Should be filtered out
		{ID: "2", Title: "high score", Score: 10, NumComments: 1, CreatedUTC: float64(now)}, // Should pass
		{ID: "2", Title: "duplicate", Score: 20, NumComments: 20, CreatedUTC: float64(now)}, // Duplicate, should be ignored
		{ID: "3", Title: "high comments", Score: 1, NumComments: 5, CreatedUTC: float64(now)}, // Should pass
		{ID: "4", Title: "too old", Score: 100, NumComments: 100, CreatedUTC: float64(now - 10*24*3600)}, // > 7 days old, filtered out
	}

	result := DeduplicateAndFilter(posts, 5, 3, 7, []string{})
	if len(result) != 2 {
		t.Fatalf("Expected 2 posts, got %d", len(result))
	}
	if result[0].ID != "2" && result[1].ID != "3" {
		t.Errorf("Unexpected post IDs: %s, %s", result[0].ID, result[1].ID)
	}

	// Test with keywords
	postsWithKeywords := []reddit.Post{
		{ID: "5", Title: "Need help with marketing", Score: 10, NumComments: 10, CreatedUTC: float64(now)}, // Should pass
		{ID: "6", Title: "Random post", Score: 10, NumComments: 10, CreatedUTC: float64(now)}, // Should fail (no keyword)
		{ID: "7", Title: "Another one", Selftext: "Marketing is hard", Score: 10, NumComments: 10, CreatedUTC: float64(now)}, // Should pass (keyword in body)
	}

	resultKW := DeduplicateAndFilter(postsWithKeywords, 5, 3, 7, []string{"marketing"})
	if len(resultKW) != 2 {
		t.Fatalf("Expected 2 posts with keywords, got %d", len(resultKW))
	}
	if resultKW[0].ID != "5" && resultKW[1].ID != "7" {
		t.Errorf("Unexpected post IDs: %s, %s", resultKW[0].ID, resultKW[1].ID)
	}
}
