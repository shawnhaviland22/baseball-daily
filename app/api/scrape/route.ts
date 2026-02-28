import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TEAMS: Record<string, string> = {
  guardians: "Cleveland Guardians",
  dodgers: "Los Angeles Dodgers",
  reds: "Cincinnati Reds",
};

export async function GET() {
  const apiKey = process.env.GNEWS_API_KEY;
  const results: Record<string, any> = {};

  // 1. Scrape & save articles
  for (const [teamId, teamName] of Object.entries(TEAMS)) {
    const query = encodeURIComponent(teamName);
    const url = `https://gnews.io/api/v4/search?q=${query}&lang=en&sortby=publishedAt&max=10&apikey=${apiKey}`;

    const res = await fetch(url, { cache: "no-store" });
    const data = await res.json();
    const articles = data.articles || [];
    let saved = 0;

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
      } catch {
        // duplicate — skip
      }
    }

    results[teamId] = { found: articles.length, saved };
  }

  // 2. Generate AI summary
  const today = new Date().toISOString().split("T")[0];
  const allArticles = await prisma.rawArticle.findMany({
    orderBy: { publishedAt: "desc" },
    take: 30,
  });

  const articleBlock = allArticles
    .map((a) => `[${a.team}] ${a.title}\n${a.content || ""}`)
    .join("\n\n");

  const completion = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a baseball journalist writing a daily newsletter for fans of the Cleveland Guardians, Los Angeles Dodgers, and Cincinnati Reds. Write an engaging Markdown summary with sections for each team using ## headers. Include key storylines, transactions, and analysis. End with a "Around the League" section for any broader MLB news.`,
      },
      {
        role: "user",
        content: `Here are today's articles:\n\n${articleBlock}\n\nWrite the daily summary for ${today}.`,
      },
    ],
  });

  const markdown = completion.choices[0]?.message?.content || "No summary generated.";

  await prisma.dailySummary.upsert({
    where: { date: today },
    update: { content: markdown },
    create: { date: today, content: markdown },
  });

  return NextResponse.json({ success: true, results, summaryDate: today });
}
