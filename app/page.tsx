"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";

const TEAMS = [
  {
    id: "guardians",
    name: "Cleveland Guardians",
    color: "from-red-700 to-blue-900",
    accent: "bg-red-700",
    logo: "⚾",
  },
  {
    id: "dodgers",
    name: "Los Angeles Dodgers",
    color: "from-blue-700 to-blue-900",
    accent: "bg-blue-700",
    logo: "⚾",
  },
  {
    id: "reds",
    name: "Cincinnati Reds",
    color: "from-red-600 to-red-900",
    accent: "bg-red-600",
    logo: "⚾",
  },
];

interface Source {
  title: string;
  url: string;
  source: string;
}

export default function Home() {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const [summary, setSummary] = useState<string>("");
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(false);
  const [scraping, setScraping] = useState(false);
  const [scrapeResults, setScrapeResults] = useState<string>("");

  async function handleScrape() {
    setScraping(true);
    setScrapeResults("");
    try {
      const res = await fetch("/api/scrape");
      const data = await res.json();
      if (data.success) {
        const counts = Object.entries(data.results)
          .map(([team, count]) => `${team}: ${count} articles`)
          .join(", ");
        setScrapeResults(`✅ Scraping complete! ${counts}`);
      } else {
        setScrapeResults("❌ Scraping failed");
      }
    } catch {
      setScrapeResults("❌ Error connecting to scraper");
    }
    setScraping(false);
  }

  async function handleSummary(teamId: string) {
    setSelectedTeam(teamId);
    setLoading(true);
    setSummary("");
    setSources([]);
    try {
      const res = await fetch(`/api/summary?team=${teamId}`);
      const data = await res.json();
      if (res.ok) {
        setSummary(data.summary || "No summary available.");
        setSources(data.sources || []);
      } else {
        setSummary(data.error || "Failed to generate summary.");
        setSources([]);
      }
    } catch {
      setSummary("Error connecting to server.");
      setSources([]);
    }
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 border-b border-gray-700">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <h1 className="text-4xl font-bold text-center mb-2">
            ⚾ Baseball Daily
          </h1>
          <p className="text-gray-400 text-center text-lg">
            AI-Powered Daily Summaries
          </p>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Scrape Button */}
        <div className="text-center mb-10">
          <button
            onClick={handleScrape}
            disabled={scraping}
            className="bg-green-600 hover:bg-green-500 disabled:bg-gray-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors text-lg"
          >
            {scraping ? "🔄 Scraping..." : "📰 Scrape Latest Articles"}
          </button>
          {scrapeResults && (
            <p className="mt-4 text-gray-300">{scrapeResults}</p>
          )}
        </div>

        {/* Team Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
          {TEAMS.map((team) => (
            <button
              key={team.id}
              onClick={() => handleSummary(team.id)}
              className={`bg-gradient-to-br ${team.color} p-6 rounded-xl hover:scale-105 transition-transform border border-gray-700 text-left`}
            >
              <div className="text-4xl mb-3">{team.logo}</div>
              <h2 className="text-xl font-bold">{team.name}</h2>
              <p className="text-gray-300 text-sm mt-2">
                Click for today&apos;s summary →
              </p>
            </button>
          ))}
        </div>

        {/* Summary Display */}
        {(loading || summary) && (
          <div className="bg-gray-900 border border-gray-700 rounded-xl p-8">
            <h2 className="text-2xl font-bold mb-1">
              {TEAMS.find((t) => t.id === selectedTeam)?.name}
            </h2>
            <p className="text-gray-400 mb-4">
              {new Date().toLocaleDateString("en-US", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>

            {loading ? (
              <div className="flex items-center gap-3 text-gray-400">
                <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full"></div>
                Generating summary...
              </div>
            ) : (
              <>
                <div className="text-gray-300 leading-relaxed prose prose-invert max-w-none">
                  <ReactMarkdown>{summary}</ReactMarkdown>
                </div>

                {/* Source Links */}
                {sources.length > 0 && (
                  <div className="mt-8 pt-6 border-t border-gray-700">
                    <h3 className="text-lg font-semibold mb-3">📰 Sources</h3>
                    <ul className="space-y-2">
                      {sources.map((s, i) => (
                        <li key={i}>
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 hover:underline"
                          >
                            {s.title}
                          </a>
                          <span className="text-gray-500 text-sm ml-2">
                            — {s.source}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
