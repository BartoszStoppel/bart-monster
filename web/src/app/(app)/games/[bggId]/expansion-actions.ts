import { action } from "@/lib/api";
export function addExpansionsToBank(args: {
  gameBggId: number;
  expansions: Array<{ name: string; bggExpansionId?: number | null }>;
}) {
  return action("addExpansionsToBank", args);
}
export function removeExpansionFromBank(args: {
  expansionId: string;
  gameBggId: number;
}) {
  return action("removeExpansionFromBank", args);
}
