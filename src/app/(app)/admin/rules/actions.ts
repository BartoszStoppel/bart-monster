"use server";

import { createClient } from "@/lib/supabase/server";
import { isAdmin } from "@/lib/admin";
import { revalidatePath } from "next/cache";

import type { RulesModuleType } from "@/types/database";

export interface SaveGameRulesInput {
  bggId: number;
  moduleName: string;
  moduleType: RulesModuleType;
  contentMd: string;
  tokenEstimate: number | null;
  source: string | null;
}

/** Insert or update a rulebook module for a game. Admin-only. Upserts on (bgg_id, module_name). */
export async function saveGameRules(input: SaveGameRulesInput) {
  const supabase = await createClient();

  if (!(await isAdmin(supabase))) {
    throw new Error("Unauthorized");
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("game_rules").upsert(
    {
      bgg_id: input.bggId,
      module_name: input.moduleName,
      module_type: input.moduleType,
      content_md: input.contentMd,
      token_estimate: input.tokenEstimate,
      source: input.source,
      created_by: user?.id ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "bgg_id,module_name" },
  );

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/rules");
}

/** Delete a rulebook module by id. Admin-only. */
export async function deleteGameRules(id: string) {
  const supabase = await createClient();

  if (!(await isAdmin(supabase))) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase.from("game_rules").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/admin/rules");
}
