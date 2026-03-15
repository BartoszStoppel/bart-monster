import { searchGames, getThingSummaries } from "@/lib/bgg/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchGames(query.trim());
  const top = results.slice(0, 20);

  if (top.length === 0) {
    return NextResponse.json({ results: [] });
  }

  const summaries = await getThingSummaries(top.map((r) => r.id));
  const summaryMap = new Map(summaries.map((s) => [s.id, s]));

  const enriched = top.map((r) => {
    const summary = summaryMap.get(r.id);
    return {
      ...r,
      thumbnailUrl: summary?.thumbnailUrl ?? undefined,
      minPlayers: summary?.minPlayers ?? undefined,
      maxPlayers: summary?.maxPlayers ?? undefined,
    };
  });

  return NextResponse.json({ results: enriched });
}
