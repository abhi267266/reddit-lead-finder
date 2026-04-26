package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL        string
	RedditClientID     string
	RedditClientSecret string
	RedditUsername     string
	RedditPassword     string
	GroqAPIKey         string
	GroqModel          string
	Port               string
	JWTSecret          string
}

func Load() *Config {
	_ = godotenv.Load() // Loads .env if it exists, ignores error if missing

	cfg := &Config{
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		RedditClientID:     os.Getenv("REDDIT_CLIENT_ID"),
		RedditClientSecret: os.Getenv("REDDIT_CLIENT_SECRET"),
		RedditUsername:     os.Getenv("REDDIT_USERNAME"),
		RedditPassword:     os.Getenv("REDDIT_PASSWORD"),
		GroqAPIKey:         os.Getenv("GROQ_API_KEY"),
		GroqModel:          os.Getenv("GROQ_MODEL"),
		Port:               os.Getenv("PORT"),
		JWTSecret:          os.Getenv("JWT_SECRET"),
	}

	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	if cfg.GroqAPIKey == "" {
		log.Println("WARNING: GROQ_API_KEY is not set. AI categorization will fail.")
	}

	if cfg.GroqModel == "" {
		cfg.GroqModel = "llama-3.1-8b-instant" // Default model
	}

	if cfg.Port == "" {
		cfg.Port = "8080"
	}

	if cfg.JWTSecret == "" {
		cfg.JWTSecret = "super-secret-dev-jwt-key" // Default for local dev
	}

	return cfg
}
