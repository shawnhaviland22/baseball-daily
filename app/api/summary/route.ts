import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const summaries = await prisma.dailySummary.findMany({
    orderBy: { date: "desc" },
    take: 3,
  });

  if (summaries.length === 0) {
    return NextResponse.json({ summary: null }, { status: 404 });
  }

  const latestDate = summaries[0].date;
  const todaySummaries = summaries.filter(
    (s) => s.date.getTime() === latestDate.getTime()
  );

  const combined = todaySummaries
    .map((s) => `# ${s.team}\n\n${s.summary}`)
    .join("\n\n---\n\n");

  return NextResponse.json({ summary: combined });
}

