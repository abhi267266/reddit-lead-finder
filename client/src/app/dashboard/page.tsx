"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { authFetch } from "@/utils/authFetch";

interface Campaign {
  ID: number;
  Name: string;
  Keywords: string[];
  Subreddits: string[];
  Active: boolean;
  CreatedAt: any;
}

interface NewCampaignForm {
  name: string;
  subreddits: string;   // comma-separated input
  keywords: string;     // comma-separated input
  product_description: string;
  schedule_minutes: number;
  min_upvotes: number;
  min_comments: number;
  max_age_days: number;
}

const defaultForm: NewCampaignForm = {
  name: "",
  subreddits: "",
  keywords: "",
  product_description: "",
  schedule_minutes: 60,
  min_upvotes: 5,
  min_comments: 3,
  max_age_days: 7,
};

export default function Dashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<NewCampaignForm>(defaultForm);
  const [formError, setFormError] = useState("");
  const [creating, setCreating] = useState(false);

  const fetchCampaigns = () => {
    authFetch("/api/campaigns")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch campaigns");
        return res.json();
      })
      .then((data) => setCampaigns(data.campaigns || []))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setCreating(true);

    try {
      const payload = {
        name: form.name,
        subreddits: form.subreddits.split(",").map((s) => s.trim()).filter(Boolean),
        keywords: form.keywords.split(",").map((k) => k.trim()).filter(Boolean),
        product_description: form.product_description,
        schedule_minutes: form.schedule_minutes,
        min_upvotes: form.min_upvotes,
        min_comments: form.min_comments,
        max_age_days: form.max_age_days,
      };

      const res = await authFetch("/api/campaigns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to create campaign");
      }

      setShowModal(false);
      setForm(defaultForm);
      setLoading(true);
      fetchCampaigns();
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Your Campaigns</h1>
          <p className="text-slate-400 text-sm mt-1">Manage your active reddit scraping jobs</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="px-4 py-2 bg-primary hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-primary/20"
        >
          + New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <div className="glass-panel rounded-2xl p-12 text-center border-dashed border-2 border-white/10">
          <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-white mb-2">No campaigns yet</h3>
          <p className="text-slate-400 max-w-sm mx-auto">Create your first campaign to start tracking keywords across Reddit and discovering high-intent leads.</p>
          <button
            onClick={() => setShowModal(true)}
            className="mt-6 px-6 py-2.5 bg-primary hover:bg-indigo-500 text-white rounded-lg text-sm font-medium transition-colors"
          >
            Create First Campaign
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {campaigns.map((c) => (
            <Link href={`/dashboard/campaigns/${c.ID}`} key={c.ID} className="block group">
              <div className="glass-panel rounded-2xl p-6 h-full transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(99,102,241,0.15)] hover:border-primary/30">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors">{c.Name}</h3>
                  <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${c.Active ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-slate-500/10 text-slate-400 border border-slate-500/20'}`}>
                    {c.Active ? 'Active' : 'Paused'}
                  </span>
                </div>
                <div className="space-y-3">
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Subreddits</span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {c.Subreddits && c.Subreddits.map(sub => (
                        <span key={sub} className="text-xs px-2 py-1 bg-white/5 text-slate-300 rounded-md">r/{sub}</span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="text-xs text-slate-500 uppercase tracking-wider font-semibold">Keywords</span>
                    <div className="flex flex-wrap gap-2 mt-1.5">
                      {c.Keywords && c.Keywords.map(kw => (
                        <span key={kw} className="text-xs px-2 py-1 bg-secondary/10 text-secondary rounded-md">"{kw}"</span>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ──────────────────── New Campaign Modal ──────────────────── */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowModal(false)}
          />

          {/* Modal Panel */}
          <div className="glass-panel relative z-10 w-full max-w-lg rounded-2xl p-8 shadow-2xl">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">New Campaign</h2>
                <p className="text-slate-400 text-sm mt-1">Set up your Reddit lead scraper</p>
              </div>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-500 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              {formError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Campaign Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
                  placeholder="e.g. Go Developer Leads"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Subreddits <span className="text-red-400">*</span>
                  <span className="text-slate-500 font-normal ml-2">(comma separated, no r/)</span>
                </label>
                <input
                  type="text"
                  required
                  value={form.subreddits}
                  onChange={(e) => setForm({ ...form, subreddits: e.target.value })}
                  className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
                  placeholder="golang, programming, learnprogramming"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-300 mb-1">
                  Keywords
                  <span className="text-slate-500 font-normal ml-2">(comma separated)</span>
                </label>
                <input
                  type="text"
                  value={form.keywords}
                  onChange={(e) => setForm({ ...form, keywords: e.target.value })}
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
                  value={form.product_description}
                  onChange={(e) => setForm({ ...form, product_description: e.target.value })}
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
                    value={form.schedule_minutes}
                    onChange={(e) => setForm({ ...form, schedule_minutes: parseInt(e.target.value) || 60 })}
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
                    value={form.max_age_days}
                    onChange={(e) => setForm({ ...form, max_age_days: parseInt(e.target.value) || 7 })}
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
                    value={form.min_upvotes}
                    onChange={(e) => setForm({ ...form, min_upvotes: parseInt(e.target.value) || 0 })}
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
                    value={form.min_comments}
                    onChange={(e) => setForm({ ...form, min_comments: parseInt(e.target.value) || 0 })}
                    className="glass-input w-full px-4 py-2.5 rounded-lg text-sm"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 text-slate-300 rounded-lg text-sm font-medium transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 py-2.5 bg-gradient-to-r from-primary to-indigo-500 text-white rounded-lg text-sm font-medium hover:from-indigo-500 hover:to-primary transition-all disabled:opacity-70 shadow-lg shadow-primary/20"
                >
                  {creating ? "Creating..." : "Create Campaign"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
