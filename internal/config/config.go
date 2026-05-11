package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL        string
	RedditUsername     string
	GroqAPIKey         string
	GroqModel          string
	Port               string
	CognitoRegion      string
	CognitoUserPoolID  string
}

func Load() *Config {
	_ = godotenv.Load() // Loads .env if it exists, ignores error if missing

	cfg := &Config{
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		RedditUsername:     os.Getenv("REDDIT_USERNAME"),
		GroqAPIKey:         os.Getenv("GROQ_API_KEY"),
		GroqModel:          os.Getenv("GROQ_MODEL"),
		Port:               os.Getenv("PORT"),
		CognitoRegion:      os.Getenv("COGNITO_REGION"),
		CognitoUserPoolID:  os.Getenv("COGNITO_USER_POOL_ID"),
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

	if cfg.CognitoRegion == "" {
		log.Println("WARNING: COGNITO_REGION is not set.")
	}
	
	if cfg.CognitoUserPoolID == "" {
		log.Println("WARNING: COGNITO_USER_POOL_ID is not set.")
	}

	return cfg
}
