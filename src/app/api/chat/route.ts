import { createClient } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

import { buildSystemPrompt } from "./build-system-prompt";
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", user.id)
    .single();
  const userName = profile?.display_name ?? "the user";

  const systemPrompt = buildSystemPrompt(userName);
  const apiMessages: Anthropic.MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  // Tool use loop: let Opus call tools, feed results back, repeat until it responds with text
  let currentMessages = [...apiMessages];
  const MAX_TOOL_ROUNDS = 5;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    const response = await client.messages.create({
      model: "claude-opus-4-6",
      max_tokens: 2048,
      system: systemPrompt,
      tools: DATA_TOOLS,
      messages: currentMessages,
    });

    const toolUseBlocks = response.content.filter(
      (b): b is Anthropic.ContentBlock & { type: "tool_use" } =>
        b.type === "tool_use",
    );

    // No tool calls — stream the final response
    if (toolUseBlocks.length === 0) {
      break;
    }

    // Execute all tool calls
    const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
      toolUseBlocks.map(async (block) => {
        const result = await executeTool(
          supabase,
          user.id,
          block.name,
          block.input as Record<string, unknown>,
        );
        return {
          type: "tool_result" as const,
          tool_use_id: block.id,
          content: result,
        };
      }),
    );

    // Add assistant response + tool results to conversation
    currentMessages = [
      ...currentMessages,
      { role: "assistant" as const, content: response.content },
      { role: "user" as const, content: toolResults },
    ];
  }

  // Final streaming call — include tools so the model understands tool history in messages
  const stream = await client.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 2048,
    system: systemPrompt,
    tools: DATA_TOOLS,
    messages: currentMessages,
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
