"use client";

import { useEffect } from "react";
import Link from "next/link";
import Image from "next/image";
import HoverMaskReveal from "../components/HoverMaskReveal";

export default function Home() {
  useEffect(() => {
    // Force scroll to top on mount to avoid jumping to hash sections
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <nav className="fixed top-0 w-full z-50 glass-panel border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-secondary flex items-center justify-center">
                <span className="text-white font-bold text-xl">L</span>
              </div>
              <span className="text-xl font-bold tracking-tight text-white">LeadPulse</span>
            </div>
            <div className="hidden md:flex items-center gap-8 text-sm font-medium text-slate-300">
              <a href="#features" className="hover:text-primary transition-colors">Features</a>
              <a href="#roadmap" className="hover:text-primary transition-colors">Roadmap</a>
              <Link href="/login" className="hover:text-primary transition-colors">Login</Link>
              <Link href="/register" className="px-5 py-2 rounded-full bg-primary hover:bg-primary/80 text-white transition-all shadow-lg shadow-primary/20">
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <main className="flex-grow pt-16">
        {/* Hero Section */}
        <section className="relative py-20 overflow-hidden">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-full bg-gradient-glow -z-10" />
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="inline-flex items-center px-3 py-1 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-semibold tracking-wide uppercase">
                AI-Powered Growth
              </div>
              <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight text-white leading-tight">
                Turn Social Noise into <span className="text-gradient">Qualified Leads</span>
              </h1>
              <p className="text-lg text-slate-400 max-w-xl leading-relaxed">
                LeadPulse monitors social conversations in real-time, identifies your ideal customers, and helps you engage with AI-crafted responses. It's not just a finder; it's your personal PR engine.
              </p>
              <div className="flex flex-wrap gap-4">
                <Link href="/register" className="px-8 py-4 rounded-xl bg-primary hover:bg-primary/80 text-white font-semibold transition-all shadow-xl shadow-primary/30 flex items-center gap-2">
                  Start Finding Leads
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                  </svg>
                </Link>
                <a href="#features" className="px-8 py-4 rounded-xl glass-panel hover:bg-white/5 text-white font-semibold transition-all">
                  How it works
                </a>
              </div>
              <div className="flex items-center gap-4 text-sm text-slate-500">
                <div className="flex -space-x-2">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="w-8 h-8 rounded-full border-2 border-dark bg-slate-800" />
                  ))}
                </div>
                <span>Joined by 500+ growth hackers</span>
              </div>
            </div>
            <div className="hidden lg:block relative w-full aspect-[4/5] max-w-[600px] mx-auto">
              <HoverMaskReveal 
                imageSrc="/landing/cute.png?v=2" 
                width="100%" 
                height="100%" 
              />
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-24 bg-dark/50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-3xl mx-auto mb-16 space-y-4">
              <h2 className="text-3xl md:text-4xl font-bold text-white">Supercharge Your Outreach</h2>
              <p className="text-slate-400">Everything you need to find, track, and close leads across social platforms.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-8">
              {[
                {
                  title: "AI Lead Discovery",
                  desc: "Our neural engine scans Reddit (and soon Twitter/YouTube) to find users who actually need your product right now.",
                  icon: "🎯"
                },
                {
                  title: "Behavior Tracking",
                  desc: "Monitor user behavior and sentiment to understand the context before you even think about reaching out.",
                  icon: "📊"
                },
                {
                  title: "AI PR Engine",
                  desc: "Generate hyper-personalized comments and responses that sound like you, not a bot. Build genuine relationships.",
                  icon: "🤖"
                }
              ].map((feature, i) => (
                <div key={i} className="p-8 rounded-2xl border border-white/5 bg-surface/50 glass-panel feature-card">
                  <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl mb-6">
                    {feature.icon}
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-3">{feature.title}</h3>
                  <p className="text-slate-400 leading-relaxed">{feature.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Roadmap Section */}
        <section id="roadmap" className="py-24 relative overflow-hidden">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="glass-panel rounded-3xl p-8 md:p-16 border border-white/5 relative">
              <div className="absolute top-0 right-0 p-8 opacity-10">
                <svg className="w-64 h-64 text-primary" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z" />
                </svg>
              </div>
              <div className="grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                  <h2 className="text-3xl md:text-4xl font-bold text-white">The Multi-Platform Future</h2>
                  <p className="text-slate-400">We started with Reddit, but we're just getting warmed up. LeadPulse is evolving into a complete social intelligence suite.</p>
                  <ul className="space-y-4">
                    {[
                      { platform: "Reddit", status: "Live", active: true },
                      { platform: "Twitter (X)", status: "Coming Soon", active: false },
                      { platform: "YouTube Comments", status: "Coming Soon", active: false },
                      { platform: "LinkedIn Integration", status: "Phase 2", active: false }
                    ].map((item, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <div className={`w-2 h-2 rounded-full ${item.active ? 'bg-green-500 shadow-lg shadow-green-500/50' : 'bg-slate-600'}`} />
                        <span className={item.active ? 'text-white font-medium' : 'text-slate-500'}>{item.platform}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${item.active ? 'bg-green-500/10 text-green-500' : 'bg-slate-800 text-slate-500'}`}>
                          {item.status}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="relative">
                  <div className="aspect-square rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center border border-white/10">
                    <div className="text-6xl animate-bounce">🚀</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-8">
            <h2 className="text-4xl md:text-5xl font-bold text-white leading-tight">
              Ready to find your next <span className="text-gradient">100 customers?</span>
            </h2>
            <p className="text-xl text-slate-400">Join the waitlist or start your 7-day free trial today.</p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register" className="w-full sm:w-auto px-10 py-5 rounded-2xl bg-white text-dark font-bold hover:bg-slate-200 transition-all text-lg">
                Get Started Now
              </Link>
              <Link href="/login" className="w-full sm:w-auto px-10 py-5 rounded-2xl glass-panel text-white font-bold hover:bg-white/5 transition-all text-lg">
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 border-t border-white/5 bg-dark">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded bg-gradient-to-br from-primary to-secondary" />
            <span className="font-bold text-white">LeadPulse</span>
          </div>
          <p className="text-slate-500 text-sm">© 2024 LeadPulse AI. All rights reserved.</p>
          <div className="flex gap-6 text-sm text-slate-400">
            <a href="#" className="hover:text-white transition-colors">Privacy</a>
            <a href="#" className="hover:text-white transition-colors">Terms</a>
            <a href="#" className="hover:text-white transition-colors">Twitter</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
