import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { redirect } from "next/navigation";

import { RulebookManager } from "./rulebook-manager";
import type { GameRulesModule } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function AdminRulesPage() {
  const supabase = await createClient();

  if (!(await isAdmin(supabase))) redirect("/");

  const [{ data: games }, { data: rules }] = await Promise.all([
    supabase.from("board_games").select("bgg_id, name").order("name"),
    supabase
      .from("game_rules")
      .select("id, bgg_id, module_name, module_type, token_estimate, source, created_at, updated_at")
      .order("bgg_id"),
  ]);

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-stack-loose">
      <section className="flex flex-col gap-stack-compact">
        <h1 className="font-display text-display-lg text-primary">Tomes of Rules</h1>
        <p className="max-w-2xl text-on-surface-variant">
          Bind rulebook scrolls to each beast in the codex. Upload a PDF, review the
          transcribed runes, and seal them for the oracle to consult.
        </p>
      </section>
      <RulebookManager
        games={games ?? []}
        existing={(rules ?? []) as Array<Omit<GameRulesModule, "content_md" | "created_by">>}
      />
    </div>
  );
}
