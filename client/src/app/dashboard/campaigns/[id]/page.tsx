"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { authFetch } from "@/utils/authFetch";

interface Post {
  ID: number;
  RedditPostID: string;
  Title: string;
  Body: string;
  Author: string;
  Subreddit: string;
  Url: string;
  Upvotes: number;
  CommentCount: number;
  PostedAt: any;
  Score: number;
  Category: string;
  AiSummary: string;
  IsLead: boolean;
  ProcessedAt?: any;
}

interface Campaign {
  ID: number;
  Name: string;
  Active: boolean;
  Keywords: string[];
  Subreddits: string[];
  ProductDescription: string;
  ScheduleMinutes: number;
  MinUpvotes: number;
  MinComments: number;
  MaxAgeDays: number;
}

interface Job {
  Status: string;
  NextRunAt: string;
  LastRunAt: string;
}

export default function CampaignDetails() {
  const { id } = useParams();
  const router = useRouter();
  const [posts, setPosts] = useState<Post[]>([]);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updating, setUpdating] = useState(false);
  const [subredditFilter, setSubredditFilter] = useState<string>("all");
  // Tick every second to drive per-post retry countdowns
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  // Edit form state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editForm, setEditForm] = useState({
    keywords: "",
    product_description: "",
    schedule_minutes: 60,
    min_upvotes: 5,
    min_comments: 3,
    max_age_days: 7,
  });
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);

  // Countdown timer
  const [timeLeft, setTimeLeft] = useState("");

  const fetchData = () => {
    return Promise.all([
      authFetch(`/api/campaigns/${id}`).then(res => {
        if (!res.ok) throw new Error("Failed to load campaign details");
        return res.json();
      }),
      authFetch(`/api/campaigns/${id}/posts`).then(res => {
        if (!res.ok) throw new Error("Failed to load campaign posts");
        return res.json();
      })
    ])
    .then(([campaignData, postsData]) => {
      setCampaign(campaignData.campaign);
      setJob(campaignData.job || null);
      setPosts(postsData.posts || []);
    });
  };

  useEffect(() => {
    // Initial load
    fetchData()
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));

    // Auto-refresh every 10 seconds
    const interval = setInterval(() => {
      fetchData().catch(console.error);
    }, 10000);

    return () => clearInterval(interval);
  }, [id]);

  useEffect(() => {
    if (!campaign) return;
    
    if (!campaign.Active) {
      setTimeLeft("Paused");
      return;
    }
    if (job?.Status === "running") {
      setTimeLeft("Running now...");
      return;
    }
    if (!job?.NextRunAt) {
      setTimeLeft("Pending...");
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const next = new Date(job.NextRunAt).getTime();
      const distance = next - now;

      if (distance < 0) {
        setTimeLeft("Starting shortly...");
      } else {
        const hours = Math.floor(distance / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);
        
        let display = "";
        if (hours > 0) display += `${hours}h `;
        display += `${minutes}m ${seconds}s`;
        setTimeLeft(display);
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [job, campaign]);

  const handleToggleStatus = async () => {
    if (!campaign) return;
    setUpdating(true);
    try {
      const res = await authFetch(`/api/campaigns/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !campaign.Active })
      });
      if (!res.ok) throw new Error("Failed to update status");
      setCampaign({ ...campaign, Active: !campaign.Active });
    } catch (err) {
      console.error(err);
      alert("Failed to update campaign status");
    } finally {
      setUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to completely remove this campaign? This will delete all associated leads and cannot be undone.")) {
      return;
    }
    setUpdating(true);
    try {
      const res = await authFetch(`/api/campaigns/${id}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to delete campaign");
      router.push('/dashboard');
    } catch (err) {
      console.error(err);
      alert("Failed to delete campaign");
      setUpdating(false);
    }
  };

  const handleDeletePost = async (postId: number) => {
    if (!confirm("Remove this post from your leads?")) {
      return;
    }
    try {
      const res = await authFetch(`/api/posts/${postId}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error("Failed to delete post");
      setPosts(posts.filter(p => p.ID !== postId));
    } catch (err) {
      console.error(err);
      alert("Failed to delete post");
    }
  };

  const handleOpenEditModal = () => {
    if (campaign) {
      setEditForm({
        keywords: campaign.Keywords ? campaign.Keywords.join(", ") : "",
        product_description: campaign.ProductDescription || "",
        schedule_minutes: campaign.ScheduleMinutes || 60,
        min_upvotes: campaign.MinUpvotes ?? 5,
        min_comments: campaign.MinComments ?? 3,
        max_age_days: campaign.MaxAgeDays ?? 7,
      });
      setShowEditModal(true);
      setEditError("");
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditError("");
    setSaving(true);

    try {
      const payload = {
        keywords: editForm.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        product_description: editForm.product_description,
        schedule_minutes: editForm.schedule_minutes,
        min_upvotes: editForm.min_upvotes,
        min_comments: editForm.min_comments,
        max_age_days: editForm.max_age_days,
      };

      const res = await authFetch(`/api/campaigns/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to update campaign");
      }

      const data = await res.json();
      setCampaign(data.campaign);
      setShowEditModal(false);
    } catch (err: any) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel p-8 text-center text-red-400 rounded-2xl">
        <p>{error}</p>
        <button onClick={() => router.push('/dashboard')} className="mt-4 text-sm text-white hover:text-primary transition-colors">
          &larr; Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Link href="/dashboard" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-white">{campaign?.Name || "Campaign Leads"}</h1>
              {campaign && (
                <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${campaign.Active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                  {campaign.Active ? 'Active' : 'Paused'}
                </span>
              )}
            </div>
            <p className="text-slate-400 text-sm mt-1">Found {posts.length} potential leads from Reddit</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Leads */}
        <div className="lg:col-span-2">
          {/* Subreddit Filter */}
          {campaign?.Subreddits && campaign.Subreddits.length > 0 && (
            <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
              <button
                onClick={() => setSubredditFilter("all")}
                className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                  subredditFilter === "all" 
                    ? "bg-primary text-white" 
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300"
                }`}
              >
                All Subreddits
              </button>
              {campaign.Subreddits.map((sub) => (
                <button
                  key={sub}
                  onClick={() => setSubredditFilter(sub)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    subredditFilter.toLowerCase() === sub.toLowerCase()
                      ? "bg-primary text-white" 
                      : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-300"
                  }`}
                >
                  <span className={subredditFilter.toLowerCase() === sub.toLowerCase() ? "text-white/70" : "text-secondary"}>r/</span>
                  {sub}
                </button>
              ))}
            </div>
          )}

          {(() => {
            const filteredPosts = subredditFilter === "all" 
              ? posts 
              : posts.filter(p => p.Subreddit.toLowerCase() === subredditFilter.toLowerCase());

            return filteredPosts.length === 0 ? (
              <div className="glass-panel rounded-2xl p-12 text-center">
              <h3 className="text-lg font-medium text-white mb-2">No leads found yet</h3>
              <p className="text-slate-400">The poller might still be running or no posts match your criteria yet. Check back in a few minutes.</p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredPosts.map((post) => (
                <div key={post.ID} className="glass-panel rounded-2xl p-6 group transition-all hover:bg-white/[0.04]">
                  <div className="flex justify-between items-start gap-4 mb-3">
                    <a 
                      href={post.Url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="text-lg font-semibold text-white group-hover:text-primary transition-colors line-clamp-2"
                    >
                      {post.Title}
                    </a>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleDeletePost(post.ID)}
                        className="flex-shrink-0 text-slate-500 hover:text-red-500 transition-colors p-1"
                        title="Remove Post"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                      <a 
                        href={post.Url} 
                        target="_blank" 
                        rel="noreferrer"
                        className="flex-shrink-0 text-slate-500 hover:text-white transition-colors p-1"
                        title="View on Reddit"
                      >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </a>
                    </div>
                  </div>
                  
                  <div className="text-sm text-slate-300 mb-4 line-clamp-3 bg-dark/50 p-4 rounded-lg">
                    {post.Body || <span className="italic text-slate-500">No body text...</span>}
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 font-medium text-slate-300 bg-white/5 px-2.5 py-1.5 rounded-md">
                      <span className="text-secondary">r/{post.Subreddit}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-md">
                      <svg className="w-4 h-4 text-emerald-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 4l-8 8h6v8h4v-8h6z" /></svg>
                      <span>{post.Upvotes}</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-md">
                      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
                      <span>{post.CommentCount} comments</span>
                    </div>
                    <div className="flex items-center gap-1.5 bg-white/5 px-2.5 py-1.5 rounded-md">
                      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                      <span>u/{post.Author}</span>
                    </div>
                  </div>

                  {/* Groq AI Analysis Section — three states: pending | error with countdown | success */}
                  {post.Category === "" ? (
                    // Pending: backend hasn't scored it yet
                    <div className="mt-5 p-3 rounded-lg border border-slate-700/50 bg-slate-800/20 flex items-center gap-3">
                      <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-indigo-500"></div>
                      <span className="text-xs text-slate-400">Groq is analyzing this post...</span>
                    </div>
                  ) : post.Category === "error" ? (() => {
                    // Error: parse Groq's retry timestamp from AiSummary
                    const retryAt = post.AiSummary ? new Date(post.AiSummary) : null;
                    const secsLeft = retryAt && !isNaN(retryAt.getTime())
                      ? Math.max(0, Math.ceil((retryAt.getTime() - now.getTime()) / 1000))
                      : null;
                    return (
                      <div className="mt-5 p-3 rounded-xl border border-amber-500/20 bg-amber-500/5 flex items-center gap-3">
                        <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="flex-1 min-w-0">
                          {secsLeft !== null && secsLeft > 0 ? (
                            <>
                              <span className="text-xs text-amber-300 font-medium">Groq rate limited — retrying in </span>
                              <span className="text-xs font-bold text-amber-200 tabular-nums">{secsLeft}s</span>
                            </>
                          ) : (
                            <span className="text-xs text-amber-300">Groq retrying now...</span>
                          )}
                          <p className="text-[10px] text-slate-500 mt-0.5">Auto-retry on next poll · No action needed</p>
                        </div>
                      </div>
                    );
                  })() : (
                    // Success: show Groq analysis card
                    <div className="mt-5 p-4 rounded-xl border border-indigo-500/20 bg-gradient-to-r from-indigo-500/10 via-purple-500/5 to-transparent relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-2 opacity-30">
                        <span className="text-[10px] font-bold tracking-widest uppercase text-indigo-400">Powered by Groq</span>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex-shrink-0 flex flex-col items-center justify-center w-14 h-14 rounded-full bg-indigo-500/20 border border-indigo-500/30">
                          <span className="text-xl font-bold text-indigo-400">{post.Score}</span>
                          <span className="text-[9px] text-indigo-300 uppercase tracking-wider">Score</span>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                              {post.Category}
                            </span>
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <svg className="w-3 h-3 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                              Llama 3 (8B)
                            </span>
                          </div>
                          <p className="text-sm text-indigo-100/80 italic">
                            "{post.AiSummary}"
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          );
          })()}
        </div>

        {/* Right Column: Config & Timer */}
        <div className="lg:col-span-1 space-y-6 lg:sticky lg:top-6 lg:self-start">
          
          {/* Timer Card */}
          <div className="glass-panel rounded-2xl p-6 text-center bg-gradient-to-br from-white/[0.05] to-transparent">
            <h3 className="text-sm font-medium text-slate-400 mb-2 uppercase tracking-wider">Next Polling Run</h3>
            <div className="text-3xl font-mono font-bold text-white mb-2">{timeLeft}</div>
            <p className="text-xs text-slate-500">
              {job?.LastRunAt ? `Last checked: ${new Date(job.LastRunAt).toLocaleString()}` : "Never checked"}
            </p>
          </div>

          {/* Configuration Card */}
          <div className="glass-panel rounded-2xl p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Configuration</h3>
              <button
                onClick={handleOpenEditModal}
                disabled={updating || !campaign}
                className="text-primary hover:text-indigo-400 text-sm font-medium transition-colors"
              >
                Edit
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Subreddits</p>
                <div className="flex flex-wrap gap-2">
                  {campaign?.Subreddits?.map(sub => (
                    <span key={sub} className="px-2 py-1 bg-white/5 rounded text-xs text-slate-300 border border-white/10">r/{sub}</span>
                  )) || <span className="text-xs text-slate-500">None</span>}
                </div>
              </div>
              
              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Keywords</p>
                <div className="flex flex-wrap gap-2">
                  {campaign?.Keywords?.map(kw => (
                    <span key={kw} className="px-2 py-1 bg-white/5 rounded text-xs text-slate-300 border border-white/10">"{kw}"</span>
                  )) || <span className="text-xs text-slate-500">None</span>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Schedule</p>
                  <p className="text-sm text-slate-300">Every {campaign?.ScheduleMinutes}m</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Max Age</p>
                  <p className="text-sm text-slate-300">{campaign?.MaxAgeDays} days</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Min Upvotes</p>
                  <p className="text-sm text-slate-300">{campaign?.MinUpvotes}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Min Comments</p>
                  <p className="text-sm text-slate-300">{campaign?.MinComments}</p>
                </div>
              </div>

              <div>
                <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">Product Description</p>
                <p className="text-sm text-slate-300 bg-dark/30 p-3 rounded-lg border border-white/5">
                  {campaign?.ProductDescription || "No description provided."}
                </p>
              </div>
            </div>
          </div>

          {/* Actions Card */}
          <div className="glass-panel rounded-2xl p-6 flex flex-col gap-3">
            <button
              onClick={handleToggleStatus}
              disabled={updating || !campaign}
              className={`w-full py-2.5 rounded-lg text-sm font-medium transition-colors ${campaign?.Active ? 'bg-amber-500/10 text-amber-500 hover:bg-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20'} disabled:opacity-50`}
            >
              {campaign?.Active ? 'Pause Campaign' : 'Resume Campaign'}
            </button>
            <button
              onClick={handleDelete}
              disabled={updating}
              className="w-full py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500/20 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              Delete Campaign
            </button>
          </div>
        </div>
      </div>

      {/* ──────────────────── Edit Campaign Modal ──────────────────── */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowEditModal(false)}
          />
          <div className="glass-panel relative z-10 w-full max-w-lg rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Edit Campaign</h2>
                <p className="text-slate-400 text-sm mt-1">Update keywords and polling schedule</p>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {editError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                  {editError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Keywords
                  <span className="text-slate-500 font-normal ml-2">(comma separated)</span>
                </label>
                <input
                  type="text"
                  value={editForm.keywords}
                  onChange={(e) => setEditForm({ ...editForm, keywords: e.target.value })}
                  className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
                  placeholder="need help, recommend a tool, looking for"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Product / Service Description
                </label>
                <textarea
                  rows={3}
                  value={editForm.product_description}
                  onChange={(e) => setEditForm({ ...editForm, product_description: e.target.value })}
                  className="glass-input w-full px-4 py-2.5 rounded-lg text-sm resize-none"
                  placeholder="Briefly describe what you sell (for AI categorization later)"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Poll every (minutes)
                  </label>
                  <input
                    type="number"
                    min={5}
                    max={1440}
                    value={editForm.schedule_minutes}
                    onChange={(e) => setEditForm({ ...editForm, schedule_minutes: parseInt(e.target.value) || 60 })}
                    className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Max Post Age (days)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    value={editForm.max_age_days}
                    onChange={(e) => setEditForm({ ...editForm, max_age_days: parseInt(e.target.value) || 7 })}
                    className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Minimum Upvotes
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.min_upvotes}
                    onChange={(e) => setEditForm({ ...editForm, min_upvotes: parseInt(e.target.value) || 0 })}
                    className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-1">
                    Minimum Comments
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={editForm.min_comments}
                    onChange={(e) => setEditForm({ ...editForm, min_comments: parseInt(e.target.value) || 0 })}
                    className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 py-2.5 bg-gradient-to-r from-primary to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-indigo-500 hover:to-primary transition-all disabled:opacity-70 shadow-lg shadow-primary/20"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
