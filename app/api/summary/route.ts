import { NextResponse } from "next/server";
import { getSummary, summarizeArticles } from "@/app/lib/summarizer";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const team = searchParams.get("team");

  if (!team) {
    return NextResponse.json({ error: "Team parameter required" }, { status: 400 });
  }

  try {
    const existing = await getSummary(team);
    if (existing) {
      return NextResponse.json(existing);
    }

    const result = await summarizeArticles(team);
    return NextResponse.json(result);
  } catch (error: any) {
    console.error("Summary error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
