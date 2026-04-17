package config

import (
	"os"
	"testing"
)

func TestLoadConfig_Success(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://test")
	os.Setenv("REDDIT_CLIENT_ID", "id")
	os.Setenv("REDDIT_CLIENT_SECRET", "secret")
	os.Setenv("REDDIT_USERNAME", "usr")
	os.Setenv("REDDIT_PASSWORD", "pwd")
	os.Setenv("PORT", "9090")
	defer os.Clearenv()

	cfg := Load()
	if cfg.DatabaseURL != "postgres://test" {
		t.Errorf("Expected DatabaseURL postgres://test, got %s", cfg.DatabaseURL)
	}
	if cfg.Port != "9090" {
		t.Errorf("Expected Port 9090, got %s", cfg.Port)
	}
}

func TestLoadConfig_DefaultsPort(t *testing.T) {
	os.Setenv("DATABASE_URL", "postgres://test")
	os.Setenv("REDDIT_CLIENT_ID", "id")
	os.Setenv("REDDIT_CLIENT_SECRET", "secret")
	os.Setenv("REDDIT_USERNAME", "usr")
	os.Setenv("REDDIT_PASSWORD", "pwd")
	os.Unsetenv("PORT")
	defer os.Clearenv()

	cfg := Load()
	if cfg.Port != "8080" {
		t.Errorf("Expected Port 8080 as default, got %s", cfg.Port)
	}
}
