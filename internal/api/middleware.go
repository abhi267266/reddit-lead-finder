package api

import (
	"context"
	"fmt"
	"net/http"

	"github.com/golang-jwt/jwt/v5"
)

type contextKey string

const (
	ctxKeyUserID contextKey = "userID"
	ctxKeyEmail  contextKey = "email"
)

func (s *Server) requireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		cookie, err := r.Cookie("session_token")
		if err != nil {
			http.Error(w, "unauthorized - no token", http.StatusUnauthorized)
			return
		}

		tokenString := cookie.Value
		token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
			}
			return []byte(s.cfg.JWTSecret), nil
		})

		if err != nil || !token.Valid {
			http.Error(w, "unauthorized - invalid token", http.StatusUnauthorized)
			return
		}

		claims, ok := token.Claims.(jwt.MapClaims)
		if !ok {
			http.Error(w, "unauthorized - bad claims", http.StatusUnauthorized)
			return
		}

		// Ensure typings are safe since JSON numbers are unmarshaled as float64 usually
		userIDFloat, ok := claims["sub"].(float64)
		if !ok {
			http.Error(w, "unauthorized - invalid user id", http.StatusUnauthorized)
			return
		}

		email, _ := claims["email"].(string)

		ctx := context.WithValue(r.Context(), ctxKeyUserID, int32(userIDFloat))
		ctx = context.WithValue(ctx, ctxKeyEmail, email)
		
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}
