import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import AmplifyInit from "@/components/AmplifyInit";

const inter = Inter({ subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "LeadPulse - AI Lead Finder & PR Tool",
  description: "Find and engage with high-quality leads automatically across Reddit, Twitter, and YouTube using AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.className} min-h-screen bg-dark text-slate-100 flex flex-col`}>
        <AmplifyInit>
          {children}
        </AmplifyInit>
      </body>
    </html>
  );
}
