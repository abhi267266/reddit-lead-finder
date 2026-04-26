package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/abhi267266/reddit-lead-finder/internal/ai"
	"github.com/abhi267266/reddit-lead-finder/internal/db"
	"github.com/abhi267266/reddit-lead-finder/internal/models"
)

// handleRecategorizePost lets a user manually re-trigger AI categorization for a single post.
// POST /api/posts/{id}/categorize
func (s *Server) handleRecategorizePost(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	postID, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		http.Error(w, "invalid post id", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value(ctxKeyUserID).(int32)

	// Fetch the post and verify ownership via campaign membership
	posts, err := s.queries.GetRawPostWithCampaign(r.Context(), db.GetRawPostWithCampaignParams{
		ID:     int32(postID),
		UserID: userID,
	})
	if err != nil || len(posts) == 0 {
		http.Error(w, "post not found or forbidden", http.StatusNotFound)
		return
	}
	post := posts[0]

	aiClient := ai.NewClient(s.cfg)
	results, _, err := aiClient.CategorizeBatch(r.Context(), post.ProductDescription, []models.RawPost{
		{
			ID:    int(post.ID),
			Title: post.Title,
			Body:  post.Body,
		},
	})
	if err != nil {
		// Mark as error again so the UI stays consistent
		_ = s.queries.UpdatePostAIFields(r.Context(), db.UpdatePostAIFieldsParams{
			ID:        int32(postID),
			Score:     0,
			Category:  "error",
			AiSummary: "",
			IsLead:    false,
		})
		http.Error(w, "ai categorization failed: "+err.Error(), http.StatusBadGateway)
		return
	}

	if len(results) == 0 {
		http.Error(w, "ai returned empty results", http.StatusBadGateway)
		return
	}

	res := results[0]
	err = s.queries.UpdatePostAIFields(r.Context(), db.UpdatePostAIFieldsParams{
		ID:        int32(postID),
		Score:     int32(res.Score),
		Category:  res.Category,
		AiSummary: res.Summary,
		IsLead:    res.IsLead,
	})
	if err != nil {
		http.Error(w, "failed to save ai result", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"score":      res.Score,
		"category":   res.Category,
		"ai_summary": res.Summary,
		"is_lead":    res.IsLead,
	})
}
