import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

const TEAMS: Record<string, string> = {
  guardians: "Cleveland Guardians",
  dodgers: "Los Angeles Dodgers",
  reds: "Cincinnati Reds",
};

export async function GET() {
  const results: Record<string, any> = {};
  const apiKey = process.env.GNEWS_API_KEY;

  for (const [teamId, teamName] of Object.entries(TEAMS)) {
    const query = encodeURIComponent(teamName);
    const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&sortby=publishedAt&max=3&apikey=${apiKey}`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();

    const articles = data.articles || [];
    let saved = 0;
    const errors: string[] = [];

    for (const article of articles) {
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
        errors.push(`${article.url?.slice(0, 50)}: ${e.message?.slice(0, 150)}`);
      }
    }

    results[teamId] = { found: articles.length, saved, errors };
  }

  return NextResponse.json({ version: "v3", success: true, results });
}
