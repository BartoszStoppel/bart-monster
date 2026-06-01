import Anthropic from "@anthropic-ai/sdk";

import type { SupabaseClient } from "../data-tools";
import type { GameRulesModule, RulesCitation } from "@/types/database";
import { buildRulesSystemPrompt } from "./system-prompt";
import { buildRulesToolset, executeRulesTool } from "./rules-tools";
import {
  normalizeQuestion,
  hashModules,
  getCachedAnswer,
  writeCachedAnswer,
} from "./answer-cache";

const AGENT_MODEL = "claude-sonnet-4-6";
const MAX_ROUNDS = 6;
const MAX_TOKENS = 3000;

export interface RulesAgentParams {
  supabase: SupabaseClient;
  userId: string;
  bggId: number;
  question: string;
  /** Names of expansions the player said are in play (matched against module_name). */
  expansions: string[];
}

export interface RulesAgentResult {
  answer: string;
  cacheHit: boolean;
}

/** Load the base module plus any in-play expansion modules for a game. */
async function loadModules(
  supabase: SupabaseClient,
  bggId: number,
  expansions: string[],
): Promise<GameRulesModule[]> {
  const { data } = await supabase
    .from("game_rules")
    .select("*")
    .eq("bgg_id", bggId);

  const rows = (data ?? []) as GameRulesModule[];
  const wanted = expansions.map((e) => e.toLowerCase().trim());

  return rows.filter(
    (m) =>
      m.module_type === "base" ||
      wanted.some((w) => m.module_name.toLowerCase().includes(w) || w.includes(m.module_name.toLowerCase())),
  );
}

async function resolveGameName(supabase: SupabaseClient, bggId: number): Promise<string> {
  const { data } = await supabase
    .from("board_games")
    .select("name")
    .eq("bgg_id", bggId)
    .maybeSingle();
  return (data?.name as string) ?? `BGG game ${bggId}`;
}

/** Collect web-search citations attached to a response's text blocks. */
function collectCitations(content: Anthropic.ContentBlock[]): RulesCitation[] {
  const citations: RulesCitation[] = [];
  for (const block of content) {
    if (block.type !== "text" || !block.citations) continue;
    for (const c of block.citations) {
      if ("url" in c && c.url) {
        citations.push({
          source_type: "web",
          label: "title" in c && c.title ? c.title : c.url,
          url: c.url,
        });
      }
    }
  }
  return citations;
}

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

/**
 * Run a Sonnet rules agent for one game and one question, returning a
 * self-contained markdown answer with sources. Checks/writes the answer cache
 * and logs the run for auditing.
 */
export async function runRulesAgent(params: RulesAgentParams): Promise<RulesAgentResult> {
  const { supabase, userId, bggId, question, expansions } = params;

  const [modules, gameName] = await Promise.all([
    loadModules(supabase, bggId, expansions),
    resolveGameName(supabase, bggId),
  ]);

  const moduleNames = modules.map((m) => m.module_name);
  const modulesHash = hashModules(moduleNames);
  const questionNorm = normalizeQuestion(question);

  const cached = await getCachedAnswer(supabase, bggId, modulesHash, questionNorm);
  if (cached) {
    await logRun(supabase, userId, bggId, question, cached.answer_md, cached.citations, [], true);
    return { answer: cached.answer_md, cacheHit: true };
  }

  const client = new Anthropic();
  const system = buildRulesSystemPrompt(gameName, modules, expansions);
  const tools = buildRulesToolset();

  const messages: Anthropic.MessageParam[] = [{ role: "user", content: question }];
  const toolCallLog: Array<{ name: string; input: unknown }> = [];
  const citations: RulesCitation[] = [];
  let answer = "";

  for (let round = 0; round < MAX_ROUNDS; round++) {
    const response = await client.messages.create({
      model: AGENT_MODEL,
      max_tokens: MAX_TOKENS,
      system,
      tools,
      messages,
    });

    messages.push({ role: "assistant", content: response.content });
    citations.push(...collectCitations(response.content));
    answer = extractText(response.content) || answer;

    const clientToolUses = response.content.filter(
      (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
    );

    if (clientToolUses.length > 0) {
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        clientToolUses.map(async (block) => {
          toolCallLog.push({ name: block.name, input: block.input });
          const result = await executeRulesTool(
            bggId,
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
      messages.push({ role: "user", content: toolResults });
      continue;
    }

    if (response.stop_reason === "pause_turn") {
      continue;
    }

    break;
  }

  if (!answer) {
    answer = "I couldn't produce a rules answer for this question — no rulebook text or sources resolved.";
  }

  await Promise.all([
    writeCachedAnswer(supabase, bggId, modulesHash, questionNorm, {
      answer_md: answer,
      citations,
    }),
    logRun(supabase, userId, bggId, question, answer, citations, toolCallLog, false),
  ]);

  return { answer, cacheHit: false };
}

async function logRun(
  supabase: SupabaseClient,
  userId: string,
  bggId: number,
  question: string,
  answer: string,
  citations: RulesCitation[],
  toolCalls: Array<{ name: string; input: unknown }>,
  cacheHit: boolean,
): Promise<void> {
  await supabase.from("rules_agent_runs").insert({
    bgg_id: bggId,
    user_id: userId,
    question,
    answer_md: answer,
    citations,
    tool_calls: toolCalls,
    cache_hit: cacheHit,
  });
}
