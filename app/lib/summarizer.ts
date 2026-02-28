import OpenAI from "openai";
import { prisma } from "./prisma";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
});

const teamNames: Record<string, string> = {
  guardians: "Cleveland Guardians",
  dodgers: "Los Angeles Dodgers",
  reds: "Cincinnati Reds",
};

interface SummaryResult {
  summary: string;
  sources: { title: string; url: string; source: string }[];
}

export async function summarizeArticles(team: string): Promise<SummaryResult> {
  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const articles = await prisma.rawArticle.findMany({
    where: {
      team,
      publishedAt: {
        gte: threeDaysAgo,
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: 15,
  });

  if (articles.length === 0) {
    return {
      summary: "No recent articles found for this team. Try scraping first!",
      sources: [],
    };
  }

  const teamName = teamNames[team] || team;

  const articleTexts = articles
    .map(
      (a, i) =>
        `Article ${i + 1}: "${a.title}"\nSource: ${a.source}\nContent: ${a.content}`
    )
    .join("\n\n");

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: `You are a knowledgeable baseball journalist. Today's date is ${dateStr}. Create a daily summary for ${teamName} fans. Be concise, informative, and engaging. Include key takeaways, game results, roster moves, and any notable storylines. Do NOT include a date in your summary title — the UI already shows it. Format with clear section headers using markdown (## for sections) and bullet points.`,
      },
      {
        role: "user",
        content: `Here are the latest articles about the ${teamName}. Create a comprehensive daily summary:\n\n${articleTexts}`,
      },
    ],
    max_tokens: 1000,
    temperature: 0.7,
  });

  const summary =
    response.choices[0]?.message?.content || "Summary unavailable.";

  const sources = articles.map((a) => ({
    title: a.title,
    url: a.url,
    source: a.source,
  }));

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  await prisma.dailySummary.upsert({
    where: {
      team_date: { team, date: today },
    },
    update: {
      summary,
      articleCount: articles.length,
      sources: articles.map((a) => a.url),
    },
    create: {
      team,
      date: today,
      summary,
      articleCount: articles.length,
      sources: articles.map((a) => a.url),
    },
  });

  return { summary, sources };
}

export async function getSummary(team: string): Promise<SummaryResult | null> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const existing = await prisma.dailySummary.findFirst({
    where: {
      team,
      date: today,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!existing) return null;

  const threeDaysAgo = new Date();
  threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

  const articles = await prisma.rawArticle.findMany({
    where: {
      team,
      publishedAt: {
        gte: threeDaysAgo,
      },
    },
    orderBy: {
      publishedAt: "desc",
    },
    take: 15,
  });

  const sources = articles.map((a) => ({
    title: a.title,
    url: a.url,
    source: a.source,
  }));

  return { summary: existing.summary, sources };
}
