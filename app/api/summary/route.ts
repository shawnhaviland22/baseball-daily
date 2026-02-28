import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/prisma";

export async function GET() {
  const today = new Date().toISOString().split("T")[0];

  const summaries = await prisma.dailySummary.findMany({
    where: {
      date: new Date(today + "T00:00:00Z"),
    },
    orderBy: { team: "asc" },
  });

  if (summaries.length === 0) {
    return NextResponse.json({ summary: null }, { status: 404 });
  }

  const combined = summaries
    .map((s) => `# ${s.team}\n\n${s.summary}`)
    .join("\n\n---\n\n");

  return NextResponse.json({ summary: combined });
}

