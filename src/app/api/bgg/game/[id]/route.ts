import { getGameDetails } from "@/lib/bgg/client";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const bggId = parseInt(id, 10);

  if (isNaN(bggId)) {
    return NextResponse.json({ error: "Invalid game ID" }, { status: 400 });
  }

  const game = await getGameDetails(bggId);

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json({ game });
}
