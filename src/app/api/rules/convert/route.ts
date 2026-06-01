import Anthropic from "@anthropic-ai/sdk";
import { NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";

export const runtime = "nodejs";
export const maxDuration = 300;

const CONVERT_MODEL = "claude-opus-4-8";

const CONVERT_PROMPT = `Convert this board game rulebook PDF into clean, well-structured Markdown.

Requirements:
- Preserve ALL rules content faithfully — do not summarize, paraphrase loosely, or omit any rule.
- Use Markdown headings (#, ##, ###) for sections and subsections.
- Use bullet or numbered lists for steps and enumerations.
- Render any tabular data (cost charts, scoring tables, faction/unit stats, reference tables) as Markdown tables — these are critical for answering rules questions, get them right.
- Omit page numbers, running headers/footers, and purely decorative text.
- Describe diagrams/illustrations briefly in [brackets] only when they convey a rule.

Output ONLY the Markdown — no preamble, no explanation.`;

/** Admin-only: convert an uploaded rulebook PDF to structured Markdown via Opus. */
export async function POST(request: NextRequest) {
  const supabase = await createClient();

  if (!(await isAdmin(supabase))) {
    return new Response("Forbidden", { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return new Response("A PDF file is required", { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return new Response("Only PDF files are supported", { status: 400 });
  }

  const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
  const client = new Anthropic();

  const message = await client.messages.create({
    model: CONVERT_MODEL,
    max_tokens: 32000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: base64 },
          },
          { type: "text", text: CONVERT_PROMPT },
        ],
      },
    ],
  });

  const markdown = message.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const truncated = message.stop_reason === "max_tokens";

  return Response.json({
    markdown,
    tokenEstimate: Math.ceil(markdown.length / 4),
    truncated,
  });
}
