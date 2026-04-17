package db

import (
	"context"
	"testing"
)

func TestNewPool_InvalidURL(t *testing.T) {
	_, err := NewPool(context.Background(), "postgres://user:pass@localhost:9999/nonexistent")
	if err == nil {
		t.Errorf("Expected error for non-existent database, got nil")
	}
}
