package api

import (
	"encoding/json"
	"net/http"
)

func (s *Server) handleMe(w http.ResponseWriter, r *http.Request) {
	userID := r.Context().Value(ctxKeyUserID).(int32)
	email := r.Context().Value(ctxKeyEmail).(string)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"user": map[string]interface{}{
			"ID":    userID,
			"Email": email,
		},
	})
}
