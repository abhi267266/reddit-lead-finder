package reddit

type ListingResponse struct {
	Data ListingData `json:"data"`
}

type ListingData struct {
	Children []PostChild `json:"children"`
}

type PostChild struct {
	Data Post `json:"data"`
}

type Post struct {
	ID          string  `json:"id"`           // Reddit's base36 post ID
	Title       string  `json:"title"`
	Selftext    string  `json:"selftext"`     // post body
	Author      string  `json:"author"`
	Subreddit   string  `json:"subreddit"`
	URL         string  `json:"url"`
	Score       int     `json:"score"`        // upvotes
	NumComments int     `json:"num_comments"`
	CreatedUTC  float64 `json:"created_utc"`  // Unix timestamp as float
	IsSelf      bool    `json:"is_self"`      // true = text post, false = link
}
