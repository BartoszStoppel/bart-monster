import { createHash } from "crypto";

import type { SupabaseClient } from "../data-tools";
import type { RulesCitation } from "@/types/database";

/** Normalize a question for cache keying: lowercase, collapse whitespace, strip trailing punctuation. */
export function normalizeQuestion(question: string): string {
  return question
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[?.!,;:]+$/g, "")
    .trim();
}

/** Stable hash of the set of loaded module names (order-independent). */
export function hashModules(moduleNames: string[]): string {
  const normalized = [...moduleNames].map((n) => n.toLowerCase().trim()).sort();
  return createHash("sha1").update(normalized.join("|")).digest("hex").slice(0, 16);
}

export interface CachedAnswer {
  answer_md: string;
  citations: RulesCitation[];
}

/** Look up a previously cached rules answer for this game + module set + question. */
export async function getCachedAnswer(
  supabase: SupabaseClient,
  bggId: number,
  modulesHash: string,
  questionNorm: string,
): Promise<CachedAnswer | null> {
  const { data } = await supabase
    .from("rules_answer_cache")
    .select("answer_md, citations")
    .eq("bgg_id", bggId)
    .eq("modules_hash", modulesHash)
    .eq("question_norm", questionNorm)
    .maybeSingle();

  if (!data) return null;
  return {
    answer_md: data.answer_md as string,
    citations: (data.citations ?? []) as RulesCitation[],
  };
}

/** Store a rules answer in the cache (best-effort; ignores duplicate-key conflicts). */
export async function writeCachedAnswer(
  supabase: SupabaseClient,
  bggId: number,
  modulesHash: string,
  questionNorm: string,
  answer: CachedAnswer,
): Promise<void> {
  await supabase.from("rules_answer_cache").upsert(
    {
      bgg_id: bggId,
      modules_hash: modulesHash,
      question_norm: questionNorm,
      answer_md: answer.answer_md,
      citations: answer.citations,
    },
    { onConflict: "bgg_id,modules_hash,question_norm" },
  );
}
