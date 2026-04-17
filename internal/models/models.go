package models

import "time"

type User struct {
	ID           int
	Email        string
	PasswordHash string
	Plan         string
	CreatedAt    time.Time
}

type Campaign struct {
	ID                 int
	UserID             int
	Name               string
	Keywords           []string
	Subreddits         []string
	ProductDescription string
	ScheduleMinutes    int
	Active             bool
	CreatedAt          time.Time
}

type RawPost struct {
	ID           int
	CampaignID   int
	RedditPostID string
	Title        string
	Body         string
	Author       string
	Subreddit    string
	URL          string
	Upvotes      int
	CommentCount int
	PostedAt     time.Time
	FetchedAt    time.Time
}

type Job struct {
	ID         int
	CampaignID int
	Status     string
	LastRunAt  *time.Time
	NextRunAt  time.Time
	Error      string
	UpdatedAt  time.Time
}
