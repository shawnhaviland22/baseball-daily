"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

export default function Home() {
  const [summary, setSummary] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeResults, setScrapeResults] = useState<string>("");

  async function handleScrape() {
    setScraping(true);
    setScrapeResults("");
    setSummary("");
    try {
      const res = await fetch("/api/scrape");
      const data = await res.json();
      if (data.success) {
        const counts = Object.entries(data.results)
          .map(([team, info]: [string, any]) => `${team}: ${info.found} found, ${info.saved} saved`)
          .join(" | ");
        setScrapeResults(`✅ ${counts}`);
        const sumRes = await fetch("/api/summary");
        const sumData = await sumRes.json();
        if (sumRes.ok && sumData.summary) {
          setSummary(sumData.summary);
        } else {
          setSummary("No summary available yet.");
        }
      } else {
        setScrapeResults("❌ Scraping failed");
      }
    } catch {
      setScrapeResults("❌ Error connecting to scraper");
    }
    setScraping(false);
  }

  async function handleLoadSummary() {
    setLoading(true);
    try {
      const res = await fetch("/api/summary");
      const data = await res.json();
      if (res.ok && data.summary) {
        setSummary(data.summary);
      } else {
        setSummary("No summary for today yet. Click 'Generate' first.");
      }
    } catch {
      setSummary("Error loading summary.");
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-8 text-center">
          <h1 className="text-4xl font-bold mb-2">⚾ Baseball Daily</h1>
          <p className="text-gray-400 text-lg">
            AI-Powered Summaries for Guardians · Dodgers · Reds
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {new Date().toLocaleDateString("en-US", {
              weekday: "long",
              year: "numeric",
              month: "long",
              day: "numeric",
            })}
          </p>
        </div>
      </div>
      <div className="max-w-4xl mx-auto px-6 py-8">
        <div className="flex gap-4 justify-center mb-8">
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            {scraping ? "⏳ Generating..." : "Generate Today's Summary"}
          </button>
          <button
            onClick={handleLoadSummary}
            disabled={loading}
            className="bg-gray-700 hover:bg-gray-600 disabled:bg-gray-600 px-6 py-3 rounded-lg font-semibold transition-colors"
          >
            {loading ? "⏳ Loading..." : "Load Latest Summary"}
          </button>
        </div>
        {scrapeResults && (
          <div className="bg-gray-800 rounded-lg p-4 mb-6 text-center text-sm text-gray-300">
            {scrapeResults}
          </div>
        )}
        {summary && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <div className="prose prose-invert max-w-none">
              <ReactMarkdown>{summary}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}


