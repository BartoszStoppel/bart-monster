import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

import {
  buildQueryPlannerPrompt,
  buildResponsePrompt,
} from "./build-system-prompt";
import { DATA_TOOLS } from "./data-tools";
import { executeTool } from "./data-tool-executors";

export const runtime = "nodejs";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const body = (await request.json()) as { messages: ChatMessage[] };
  const { messages } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response("Messages required", { status: 400 });
  }

  const client = new Anthropic();

  // Fetch user's display name
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const userName = profile?.display_name ?? "the user";

  // Call 1: Sonnet decides which DB queries to run
  const plannerPrompt = buildQueryPlannerPrompt(userName);

  const plannerResponse = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: plannerPrompt,
    tools: DATA_TOOLS,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  // Capture planner reasoning + execute tool calls
  const plannerNotes: string[] = [];
  const resultParts: string[] = [];

  for (const block of plannerResponse.content) {
    if (block.type === "text" && block.text.trim()) {
      plannerNotes.push(block.text.trim());
    }
    if (block.type === "tool_use") {
      const result = await executeTool(
        supabase,
        user.id,
        block.name,
        block.input as Record<string, unknown>,
      );
      resultParts.push(`### ${block.name}\n${result}`);
    }
  }

  const plannerContext = plannerNotes.length > 0
    ? `## Query Planner Notes\n${plannerNotes.join("\n")}\n\n`
    : "";

  const queryResults = resultParts.length > 0
    ? `${plannerContext}${resultParts.join("\n\n")}`
    : "No data was queried. Answer based on general board game knowledge, noting you don't have collection-specific data for this question.";

  // Call 2: Sonnet generates the response using exact DB results
  const responsePrompt = buildResponsePrompt(userName, queryResults);

  const stream = await client.messages.stream({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    system: responsePrompt,
    messages: messages.map((m) => ({ role: m.role, content: m.content })),
  });

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      for await (const event of stream) {
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
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
