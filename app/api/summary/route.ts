import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

const TEAMS: Record<string, string> = {
  guardians: "Cleveland Guardians",
  dodgers: "Los Angeles Dodgers",
  reds: "Cincinnati Reds",
};

async function scrapeTeam(teamId: string, teamName: string): Promise<{ saved: number; raw: any }> {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) throw new Error("GNEWS_API_KEY not set");

  const query = encodeURIComponent(`${teamName}`);
  const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&sortby=publishedAt&max=10&apikey=${apiKey}`;

  const res = await fetch(url);
  const data = await res.json();

  if (!data.articles || data.articles.length === 0) {
    return { saved: 0, raw: data };
  }

  let saved = 0;

  for (const article of data.articles) {
    try {
      await prisma.rawArticle.upsert({
        where: { url: article.url },
        update: {},
        create: {
          team: teamId,
          title: article.title || "Untitled",
          url: article.url,
          source: article.source?.name || "Unknown",
          author: null,
          publishedAt: article.publishedAt ? new Date(article.publishedAt) : null,
          content: article.content || article.description || null,
        },
      });
      saved++;
    } catch (e: any) {
      console.error(`Skip article: ${e.message}`);
    }
  }

  return { saved, raw: `${data.articles.length} articles found` };
}

export async function GET() {
  try {
    const results: Record<string, any> = {};

    for (const [teamId, teamName] of Object.entries(TEAMS)) {
      results[teamId] = await scrapeTeam(teamId, teamName);
    }

    return NextResponse.json({ success: true, results });
  } catch (error: any) {
    console.error("Scrape error:", error.message);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
