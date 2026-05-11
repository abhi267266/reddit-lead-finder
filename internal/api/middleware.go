package api

import (
	"context"
	"net/http"
	"strings"

	"github.com/abhi267266/reddit-lead-finder/internal/db"
	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	ctxKeyUserID contextKey = "userID"
	ctxKeyEmail  contextKey = "email"
)

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		authHeader := r.Header.Get("Authorization")
		if authHeader == "" || !strings.HasPrefix(authHeader, "Bearer ") {
			http.Error(w, "unauthorized - no token", http.StatusUnauthorized)
			return
		}

		tokenString := strings.TrimPrefix(authHeader, "Bearer ")

		if s.jwks == nil {
			http.Error(w, "unauthorized - auth not configured", http.StatusInternalServerError)
			return
		}

		token, err := jwt.Parse(tokenString, s.jwks.Keyfunc)
		if err != nil || !token.Valid {
			http.Error(w, "unauthorized - invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, "unauthorized - bad claims", http.StatusUnauthorized)
			return
		}

		// Cognito ID token usually has "email". Access token might not.
		// Ensure frontend is passing the ID token, or we pull username/sub if it's an access token.
		emailRaw, ok := claims["email"]
		if !ok {
			http.Error(w, "unauthorized - missing email claim", http.StatusUnauthorized)
			return
		}
		email := emailRaw.(string)

		// Lazy Sync: check if user exists in DB
		user, err := s.queries.GetUserByEmail(r.Context(), email)
		if err != nil {
			// User not found (or DB error), lazy create
			user, err = s.queries.CreateUser(r.Context(), db.CreateUserParams{
				Email: email,
				Plan:  "free",
			})
			if err != nil {
				http.Error(w, "internal error - failed to sync user", http.StatusInternalServerError)
				return
			}
		}

		ctx := context.WithValue(r.Context(), ctxKeyUserID, user.ID)
		ctx = context.WithValue(ctx, ctxKeyEmail, user.Email)

		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
