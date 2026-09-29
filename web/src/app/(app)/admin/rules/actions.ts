import { action } from "@/lib/api";
export interface SaveGameRulesInput {
  bggId: number;
  moduleName: string;
  moduleType: "base" | "expansion";
  contentMd: string;
  tokenEstimate: number | null;
  source: string | null;
}
export function saveGameRules(args: SaveGameRulesInput) {
  return action("saveGameRules", { ...args });
}
export function deleteGameRules(id: string) {
  return action("deleteGameRules", { id });
}
