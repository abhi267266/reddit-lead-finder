package main

import (
	"context"
	"errors"
	"fmt"
	"log"
	"log/slog"
	"net/http"
	"os"
	"os/exec"
	"os/signal"
	"syscall"
	"time"

	"github.com/abhi267266/reddit-lead-finder/internal/config"
	"github.com/abhi267266/reddit-lead-finder/internal/db"
	"github.com/abhi267266/reddit-lead-finder/internal/poller"
	"github.com/abhi267266/reddit-lead-finder/internal/reddit"
)

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	cfg := config.Load()

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		sigChan := make(chan os.Signal, 1)
		signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
		<-sigChan
		slog.Info("Shutting down gracefully...")
		cancel()
	}()

	// Run migrations via the migration script
	slog.Info("Running migrations...")
	cmd := exec.Command("bash", "migration.sh", "up")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	cmd.Env = append(os.Environ(), fmt.Sprintf("DATABASE_URL=%s", cfg.DatabaseURL))
	if err := cmd.Run(); err != nil {
		log.Fatalf("Migration failed: %v", err)
	}

	pool, err := db.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("Failed to connect to database: %v", err)
	}
	defer pool.Close()

	redditClient := reddit.NewClient(cfg)

	// Start poller scheduler
	go func() {
		if err := poller.StartScheduler(ctx, pool, redditClient); err != nil {
			slog.Error("scheduler exited with error", "error", err)
		}
	}()

	mux := http.NewServeMux()
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("OK"))
	})

	server := &http.Server{
		Addr:    ":" + cfg.Port,
		Handler: mux,
	}

	go func() {
		slog.Info("Starting server", "port", cfg.Port)
		if err := server.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			slog.Error("HTTP server failed", "error", err)
		}
	}()

	<-ctx.Done()

	shutdownCtx, shutdownCancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer shutdownCancel()

	if err := server.Shutdown(shutdownCtx); err != nil {
		slog.Error("HTTP shutdown error", "error", err)
	}
	slog.Info("Shutdown complete")
}
