import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

const TEAMS: Record<string, string> = {
  guardians: "Cleveland Guardians",
  dodgers: "Los Angeles Dodgers",
  reds: "Cincinnati Reds",
};

async function scrapeTeam(teamId: string, teamName: string): Promise<number> {
  const apiKey = process.env.NEWS_API_KEY;
  if (!apiKey) throw new Error("NEWS_API_KEY not set");

  const url = `https://newsapi.org/v2/everything?q="${teamName}" baseball&sortBy=publishedAt&pageSize=15&apiKey=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (data.status !== "ok") {
    console.error(`NewsAPI error for ${teamId}:`, data.message);
    return 0;
  }

  let saved = 0;

  for (const article of data.articles || []) {
    try {
      await prisma.rawArticle.upsert({
        where: { url: article.url },
        update: {},
        create: {
          team: teamId,
          title: article.title || "Untitled",
          url: article.url,
          source: article.source?.name || "Unknown",
          author: article.author || null,
          publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
          content: article.content || article.description || null,
        },
      });
      saved++;
    } catch (e: any) {
      // Skip duplicates or bad data
      console.error(`Skip article: ${e.message}`);
    }
  }

  return saved;
}

export async function GET() {
  try {
    const results: Record<string, number> = {};

    for (const [teamId, teamName] of Object.entries(TEAMS)) {
      results[teamId] = await scrapeTeam(teamId, teamName);
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Scrape error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
