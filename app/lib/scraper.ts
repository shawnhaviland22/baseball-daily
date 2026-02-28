import { prisma } from "./prisma";

const NEWS_API_KEY = process.env.NEWS_API_KEY!;

const TEAMS = {
  guardians: {
    query: "Cleveland Guardians",
    writers: ["Zack Meisel", "Mandy Bell", "Paul Hoynes"],
  },
  dodgers: {
    query: "Los Angeles Dodgers",
    writers: ["Fabian Ardaya", "Jack Harris", "Juan Toribio"],
  },
  reds: {
    query: "Cincinnati Reds",
    writers: ["C. Trent Rosecrans", "Charlie Goldsmith", "Mark Sheldon"],
  },
};

async function searchNews(query: string) {
  const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(query)}&language=en&sortBy=publishedAt&pageSize=10&apiKey=${NEWS_API_KEY}`;

  try {
    const res = await fetch(url);
    const data = await res.json();

    if (data.status !== "ok") {
      console.error("NewsAPI error:", data.message);
      return [];
    }

    return data.articles.map((article: any) => ({
      title: article.title,
      url: article.url,
      snippet: article.description || "",
      source: article.source?.name || "Unknown",
      publishedAt: article.publishedAt ? new Date(article.publishedAt) : new Date(),
    }));
  } catch (error) {
    console.error(`Search error for "${query}":`, error);
    return [];
  }
}

async function saveArticle(
  teamId: string,
  source: string,
  article: { title: string; url: string; snippet: string; publishedAt: Date }
) {
  try {
    await prisma.rawArticle.upsert({
      where: { url: article.url },
      update: {},
      create: {
        team: teamId,
        source: source,
        title: article.title,
        url: article.url,
        content: article.snippet || "",
        publishedAt: article.publishedAt,
      },
    });
    return true;
  } catch (error) {
    console.error("Error saving article:", error);
    return false;
  }
}

async function scrapeTeam(teamId: string) {
  const config = TEAMS[teamId as keyof typeof TEAMS];
  if (!config) return 0;

  let savedCount = 0;

  // Main team search
  console.log(`  Searching: ${config.query}`);
  const articles = await searchNews(config.query);
  for (const article of articles) {
    const saved = await saveArticle(teamId, article.source, article);
    if (saved) savedCount++;
  }

  // Writer-specific searches
  for (const writer of config.writers) {
    console.log(`  Searching writer: ${writer}`);
    const writerArticles = await searchNews(`${writer} ${config.query}`);
    for (const article of writerArticles) {
      const saved = await saveArticle(teamId, writer, article);
      if (saved) savedCount++;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return savedCount;
}

export async function scrapeAllTeams() {
  const results: Record<string, number> = {};

  for (const teamId of Object.keys(TEAMS)) {
    console.log(`Scraping ${teamId}...`);
    results[teamId] = await scrapeTeam(teamId);
    console.log(`${teamId}: ${results[teamId]} articles saved`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}
