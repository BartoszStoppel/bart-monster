import { searchGames } from "@/lib/bgg/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q");

  if (!query || query.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const results = await searchGames(query.trim());
  return NextResponse.json({ results });
}
