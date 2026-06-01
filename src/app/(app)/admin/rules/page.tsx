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
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-50">
        Admin — Rulebooks
      </h1>
      <RulebookManager
        games={games ?? []}
        existing={(rules ?? []) as Array<Omit<GameRulesModule, "content_md" | "created_by">>}
      />
    </div>
  );
}
