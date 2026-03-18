import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const MIN_RATINGS = 3;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/**
 * Builds a system prompt with context about rankings for the current user.
 */
async function buildSystemPrompt(supabase: Awaited<ReturnType<typeof createClient>>, userId: string): Promise<string> {
  const [
    { data: games },
    { data: placements },
    { data: userPlacements },
    { data: profile },
  ] = await Promise.all([
    supabase.from("board_games").select("bgg_id, name, bgg_rating, bgg_weight, category, min_players, max_players, playing_time, mechanics, categories"),
    supabase.from("tier_placements").select("bgg_id, score, user_id"),
    supabase.from("tier_placements").select("bgg_id, tier, score").eq("user_id", userId),
    supabase.from("profiles").select("display_name").eq("id", userId).single(),
  ]);

  const gameMap = new Map((games ?? []).map((g) => [g.bgg_id, g]));

  const scoreAcc = new Map<number, { total: number; count: number }>();
  for (const p of placements ?? []) {
    if (p.score == null) continue;
    const entry = scoreAcc.get(p.bgg_id) ?? { total: 0, count: 0 };
    entry.total += p.score;
    entry.count += 1;
    scoreAcc.set(p.bgg_id, entry);
  }

  const communityScores = new Map<number, number>();
  for (const [bggId, { total, count }] of scoreAcc) {
    if (count >= MIN_RATINGS) {
      communityScores.set(bggId, Math.round((total / count) * 10) / 10);
    }
  }

  const userRankings = (userPlacements ?? [])
    .filter((p) => p.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .map((p) => {
      const g = gameMap.get(p.bgg_id);
      if (!g) return null;
      return `- ${g.name} (Tier ${p.tier}, score ${p.score?.toFixed(1)})`;
    })
    .filter(Boolean);

  const communityRankings = [...communityScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([bggId, avg]) => {
      const g = gameMap.get(bggId);
      if (!g) return null;
      const bgg = g.bgg_rating ? `, BGG ${Number(g.bgg_rating).toFixed(1)}` : "";
      return `- ${g.name}: community ${avg.toFixed(1)}${bgg}`;
    })
    .filter(Boolean);

  const gameList = (games ?? [])
    .map((g) => {
      const players = g.min_players && g.max_players
        ? `${g.min_players}-${g.max_players}p`
        : null;
      const time = g.playing_time ? `${g.playing_time}min` : null;
      const weight = g.bgg_weight ? `weight ${Number(g.bgg_weight).toFixed(1)}` : null;
      const bgg = g.bgg_rating ? `BGG ${Number(g.bgg_rating).toFixed(1)}` : null;
      const mechs = g.mechanics?.length ? `mechanics: ${g.mechanics.join(", ")}` : null;
      const cats = g.categories?.length ? `categories: ${g.categories.join(", ")}` : null;
      const details = [players, time, weight, bgg, g.category, mechs, cats].filter(Boolean).join(", ");
      return `- ${g.name} (${details})`;
    });

  const userName = profile?.display_name ?? "the user";

  return `You are a friendly board game advisor for a small friend group's board game collection site called bart.monster. Your name is Bort.

The user you're talking to is ${userName}.

## Collection (${gameList.length} games)
${gameList.join("\n")}

## ${userName}'s Rankings (${userRankings.length} games ranked, scores 1-10)
Only these games have been played and ranked by ${userName}. Do NOT assume the user has played any game not listed here.
${userRankings.length > 0 ? userRankings.join("\n") : "No games ranked yet."}

## Community Rankings (avg of ${MIN_RATINGS}+ tier lists, scores 1-10)
${communityRankings.length > 0 ? communityRankings.join("\n") : "Not enough rankings yet."}

## Rules
- Be concise and conversational. Use markdown formatting (bold, lists, headers, tables) for longer responses.
- **CRITICAL: Only use scores and data from the sections above. NEVER invent, estimate, or round scores.** If a game appears in the user's rankings, use exactly the score listed. If a game has no community score listed above, say it has no community score — do NOT make one up.
- Only describe game mechanics or categories if they are listed in the Collection data above. Do NOT guess or infer mechanics.
- When recommending games from the collection, cite the relevant data (scores, player count, time).
- When recommending games NOT in the collection, clearly note they're not in the group's collection.
- When comparing scores, only include games where both scores exist and the difference is meaningful.
- Keep responses focused and avoid long preambles.`;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = await request.json() as { messages: ChatMessage[] };
  const { messages } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Messages required", { status: 400 });
  }

  const systemPrompt = await buildSystemPrompt(supabase, user.id);

  const client = new Anthropic();

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: systemPrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          controller.enqueue(encoder.encode(event.delta.text));
        }
      }
      controller.close();
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
