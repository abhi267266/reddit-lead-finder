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
	Port               string
}

func Load() *Config {
	_ = godotenv.Load() // Loads .env if it exists, ignores error if missing

	cfg := &Config{
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		RedditClientID:     os.Getenv("REDDIT_CLIENT_ID"),
		RedditClientSecret: os.Getenv("REDDIT_CLIENT_SECRET"),
		RedditUsername:     os.Getenv("REDDIT_USERNAME"),
		RedditPassword:     os.Getenv("REDDIT_PASSWORD"),
		Port:               os.Getenv("PORT"),
	}

	if cfg.DatabaseURL == "" {
		log.Fatal("DATABASE_URL is required")
	}

	if cfg.Port == "" {
		cfg.Port = "8080"
	}

	return cfg
}
