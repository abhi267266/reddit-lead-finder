package api

import (
	"net/http"

	"github.com/abhi267266/reddit-lead-finder/internal/config"
	"github.com/abhi267266/reddit-lead-finder/internal/db"
	"github.com/jackc/pgx/v5/pgxpool"
)

type Server struct {
	mux     *http.ServeMux
	pool    *pgxpool.Pool
	queries *db.Queries
	cfg     *config.Config
}

// RegisterRoutes sets up all API handlers
func RegisterRoutes(mux *http.ServeMux, pool *pgxpool.Pool, cfg *config.Config) {
	s := &Server{
		mux:     mux,
		pool:    pool,
		queries: db.New(pool),
		cfg:     cfg,
	}

	// Unprotected routes
	mux.HandleFunc("POST /api/auth/register", s.handleRegister)
	mux.HandleFunc("POST /api/auth/login", s.handleLogin)
	mux.HandleFunc("POST /api/auth/logout", s.handleLogout)

	// Protected routes
	mux.Handle("GET /api/auth/me", s.requireAuth(http.HandlerFunc(s.handleMe)))
	mux.Handle("GET /api/campaigns", s.requireAuth(http.HandlerFunc(s.handleListCampaigns)))
	mux.Handle("POST /api/campaigns", s.requireAuth(http.HandlerFunc(s.handleCreateCampaign)))
	mux.Handle("GET /api/campaigns/{id}", s.requireAuth(http.HandlerFunc(s.handleGetCampaign)))
	mux.Handle("PATCH /api/campaigns/{id}", s.requireAuth(http.HandlerFunc(s.handleUpdateCampaign)))
	mux.Handle("PATCH /api/campaigns/{id}/status", s.requireAuth(http.HandlerFunc(s.handleUpdateCampaignStatus)))
	mux.Handle("DELETE /api/campaigns/{id}", s.requireAuth(http.HandlerFunc(s.handleDeleteCampaign)))
	mux.Handle("GET /api/campaigns/{id}/posts", s.requireAuth(http.HandlerFunc(s.handleListPosts)))
	mux.Handle("DELETE /api/posts/{id}", s.requireAuth(http.HandlerFunc(s.handleDeletePost)))
	mux.Handle("POST /api/posts/{id}/categorize", s.requireAuth(http.HandlerFunc(s.handleRecategorizePost)))
}
