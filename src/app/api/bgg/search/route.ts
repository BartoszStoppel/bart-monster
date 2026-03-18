import { searchGames, getThingSummaries } from "@/lib/bgg/client";
import { NextResponse } from "next/server";
import type { BggSearchResult } from "@/lib/bgg/types";

function scoreResult(result: BggSearchResult, query: string): number {
  const name = result.name.toLowerCase();
  const q = query.toLowerCase();

  let score: number;
  if (name === q) {
    score = 100;
  } else if (name.startsWith(q)) {
    score = 80;
  } else if (new RegExp(`\\b${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`).test(name)) {
    score = 60;
  } else if (name.includes(q)) {
    score = 40;
  } else {
    score = 20;
  }

  return score;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const trimmed = query.trim();
  const results = await searchGames(trimmed);

  results.sort((a, b) => {
    const scoreDiff = scoreResult(b, trimmed) - scoreResult(a, trimmed);
    if (scoreDiff !== 0) return scoreDiff;
    const yearA = a.yearPublished ?? 0;
    const yearB = b.yearPublished ?? 0;
    return yearB - yearA;
  });

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
