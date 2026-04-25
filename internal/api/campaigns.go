package api

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/abhi267266/reddit-lead-finder/internal/db"
)

func (s *Server) handleListCampaigns(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(ctxKeyUserID).(int32)

	campaigns, err := s.queries.ListCampaignsByUser(r.Context(), userID)
	if err != nil {
		http.Error(w, "failed to query campaigns", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	if campaigns == nil {
		campaigns = []db.Campaign{} // ensure we don't return null
	}
	json.NewEncoder(w).Encode(map[string]interface{}{
		"campaigns": campaigns,
	})
}

type CreateCampaignReq struct {
	Name               string   `json:"name"`
	Keywords           []string `json:"keywords"`
	Subreddits         []string `json:"subreddits"`
	ProductDescription string   `json:"product_description"`
	ScheduleMinutes    int32    `json:"schedule_minutes"`
	MinUpvotes         int32    `json:"min_upvotes"`
	MinComments        int32    `json:"min_comments"`
	MaxAgeDays         int32    `json:"max_age_days"`
}

func (s *Server) handleCreateCampaign(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(ctxKeyUserID).(int32)

	var req CreateCampaignReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.Name == "" {
		http.Error(w, "campaign name is required", http.StatusBadRequest)
		return
	}
	if len(req.Subreddits) == 0 {
		http.Error(w, "at least one subreddit is required", http.StatusBadRequest)
		return
	}
	if req.ScheduleMinutes <= 0 {
		req.ScheduleMinutes = 60 // default to 1 hour
	}
	if req.MaxAgeDays <= 0 {
		req.MaxAgeDays = 7 // default 7 days
	}

	campaign, err := s.queries.CreateCampaign(r.Context(), db.CreateCampaignParams{
		UserID:             userID,
		Name:               req.Name,
		Keywords:           req.Keywords,
		Subreddits:         req.Subreddits,
		ProductDescription: req.ProductDescription,
		ScheduleMinutes:    req.ScheduleMinutes,
		Active:             true,
		MinUpvotes:         req.MinUpvotes,
		MinComments:        req.MinComments,
		MaxAgeDays:         req.MaxAgeDays,
	})
	if err != nil {
		http.Error(w, "failed to create campaign", http.StatusInternalServerError)
		return
	}

	// Also create the initial job for the scheduler to pick up
	const initJob = `
		INSERT INTO jobs (campaign_id, status)
		VALUES ($1, 'pending')
		ON CONFLICT (campaign_id) DO NOTHING
	`
	_, _ = s.pool.Exec(r.Context(), initJob, campaign.ID)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"campaign": campaign,
	})
}


func (s *Server) handleListPosts(w http.ResponseWriter, r *http.Request) {
	// e.g. GET /api/campaigns/1/posts
	idStr := r.PathValue("id")
	campaignID, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		http.Error(w, "invalid campaign id", http.StatusBadRequest)
		return
	}

	// Verify the campaign actually belongs to this user.
	// We don't have a specific `GetCampaignByIdAndUser` query, so we'll just check all campaigns for the user.
	// Or we can just trust the endpoint temporarily, but for security:
	userID := r.Context().Value(ctxKeyUserID).(int32)
	campaigns, err := s.queries.ListCampaignsByUser(r.Context(), userID)
	if err != nil {
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	
	ownsCampaign := false
	for _, c := range campaigns {
		if c.ID == int32(campaignID) {
			ownsCampaign = true
			break
		}
	}

	if !ownsCampaign {
		http.Error(w, "campaign not found or forbidden", http.StatusForbidden)
		return
	}

	posts, err := s.queries.ListPostsByCampaign(r.Context(), int32(campaignID))
	if err != nil {
		http.Error(w, "failed to query posts", http.StatusInternalServerError)
		return
	}

	if posts == nil {
		posts = []db.RawPost{}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"posts": posts,
	})
}

func (s *Server) handleGetCampaign(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	campaignID, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		http.Error(w, "invalid campaign id", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value(ctxKeyUserID).(int32)
	campaign, err := s.queries.GetCampaign(r.Context(), db.GetCampaignParams{
		ID:     int32(campaignID),
		UserID: userID,
	})
	if err != nil {
		http.Error(w, "campaign not found", http.StatusNotFound)
		return
	}

	// Also fetch the current job status
	job, err := s.queries.GetJobByCampaignID(r.Context(), int32(campaignID))
	// We can ignore err if no job exists yet

	w.Header().Set("Content-Type", "application/json")
	responsePayload := map[string]interface{}{
		"campaign": campaign,
	}
	if err == nil {
		responsePayload["job"] = job
	}

	json.NewEncoder(w).Encode(responsePayload)
}

type UpdateCampaignStatusReq struct {
	Active bool `json:"active"`
}

func (s *Server) handleUpdateCampaignStatus(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	campaignID, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		http.Error(w, "invalid campaign id", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value(ctxKeyUserID).(int32)

	var req UpdateCampaignStatusReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	err = s.queries.UpdateCampaignActiveStatus(r.Context(), db.UpdateCampaignActiveStatusParams{
		ID:     int32(campaignID),
		Active: req.Active,
		UserID: userID,
	})
	if err != nil {
		http.Error(w, "failed to update campaign status", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

func (s *Server) handleDeleteCampaign(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	campaignID, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		http.Error(w, "invalid campaign id", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value(ctxKeyUserID).(int32)

	err = s.queries.DeleteCampaign(r.Context(), db.DeleteCampaignParams{
		ID:     int32(campaignID),
		UserID: userID,
	})
	if err != nil {
		http.Error(w, "failed to delete campaign", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

type UpdateCampaignReq struct {
	Keywords           []string `json:"keywords"`
	ProductDescription string   `json:"product_description"`
	ScheduleMinutes    int32    `json:"schedule_minutes"`
	MinUpvotes         int32    `json:"min_upvotes"`
	MinComments        int32    `json:"min_comments"`
	MaxAgeDays         int32    `json:"max_age_days"`
}

func (s *Server) handleUpdateCampaign(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	campaignID, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		http.Error(w, "invalid campaign id", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value(ctxKeyUserID).(int32)

	var req UpdateCampaignReq
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request body", http.StatusBadRequest)
		return
	}

	if req.ScheduleMinutes <= 0 {
		req.ScheduleMinutes = 60
	}
	if req.MaxAgeDays <= 0 {
		req.MaxAgeDays = 7
	}

	campaign, err := s.queries.UpdateCampaign(r.Context(), db.UpdateCampaignParams{
		ID:                 int32(campaignID),
		UserID:             userID,
		Keywords:           req.Keywords,
		ProductDescription: req.ProductDescription,
		ScheduleMinutes:    req.ScheduleMinutes,
		MinUpvotes:         req.MinUpvotes,
		MinComments:        req.MinComments,
		MaxAgeDays:         req.MaxAgeDays,
	})
	if err != nil {
		http.Error(w, "failed to update campaign", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"campaign": campaign,
	})
}

func (s *Server) handleDeletePost(w http.ResponseWriter, r *http.Request) {
	idStr := r.PathValue("id")
	postID, err := strconv.ParseInt(idStr, 10, 32)
	if err != nil {
		http.Error(w, "invalid post id", http.StatusBadRequest)
		return
	}

	userID := r.Context().Value(ctxKeyUserID).(int32)

	err = s.queries.DeleteRawPost(r.Context(), db.DeleteRawPostParams{
		ID:     int32(postID),
		UserID: userID,
	})
	if err != nil {
		http.Error(w, "failed to delete post", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
