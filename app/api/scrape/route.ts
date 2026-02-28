import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";
import OpenAI from "openai";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const TEAMS = [
  { name: "Guardians", rssUrl: "https://www.espn.com/espn/rss/mlb/news?team=cle" },
  { name: "Dodgers", rssUrl: "https://www.espn.com/espn/rss/mlb/news?team=lad" },
  { name: "Reds", rssUrl: "https://www.espn.com/espn/rss/mlb/news?team=cin" },
];

function extractItems(xml: string) {
  const items: { title: string; link: string; description: string }[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]>/)?.[1] ||
      block.match(/<title>(.*?)<\/title>/)?.[1] || "";
    const link = block.match(/<link>(.*?)<\/link>/)?.[1] || "";
    const description = block.match(/<description><!\[CDATA\[(.*?)\]\]>/)?.[1] ||
      block.match(/<description>(.*?)<\/description>/)?.[1] || "";
    if (title) items.push({ title, link, description });
  }
  return items;
}

export async function GET() {
  const today = new Date().toISOString().split("T")[0];
  const results: Record<string, { found: number; saved: number }> = {};

  for (const team of TEAMS) {
    try {
      const res = await fetch(team.rssUrl, {
        headers: { "User-Agent": "BaseballDaily/1.0" },
      });
      const xml = await res.text();
      const items = extractItems(xml);

      let saved = 0;
      for (const item of items) {
        try {
          await prisma.rawArticle.create({
            data: {
              team: team.name,
              title: item.title,
              url: item.link,
              source: "ESPN RSS",
              content: item.description,
            },
          });
          saved++;
        } catch {
          // duplicate URL, skip
        }
      }
      results[team.name] = { found: items.length, saved };
    } catch {
      results[team.name] = { found: 0, saved: 0 };
    }
  }

  for (const team of TEAMS) {
    const articles = await prisma.rawArticle.findMany({
      where: {
        team: team.name,
        createdAt: { gte: new Date(today + "T00:00:00Z") },
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    });

    if (articles.length === 0) continue;

    const articleText = articles
      .map((a, i) => `${i + 1}. ${a.title}\n${a.content || ""}`)
      .join("\n\n");

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a baseball beat writer. Write a concise daily summary for the ${team.name}. Use markdown with headers. Include key storylines, player updates, and what to watch.`,
        },
        {
          role: "user",
          content: `Here are today's articles:\n\n${articleText}`,
        },
      ],
    });

    const summaryText = completion.choices[0]?.message?.content || "No summary generated.";
    const sources = articles.map((a) => a.url);

    await prisma.dailySummary.upsert({
      where: {
        team_date: { team: team.name, date: new Date(today + "T00:00:00Z") },
      },
      update: {
        summary: summaryText,
        articleCount: articles.length,
        sources,
      },
      create: {
        team: team.name,
        date: new Date(today + "T00:00:00Z"),
        summary: summaryText,
        articleCount: articles.length,
        sources,
      },
    });
  }

  return NextResponse.json({
    success: true,
    summaryDate: today,
    results,
  });
}

