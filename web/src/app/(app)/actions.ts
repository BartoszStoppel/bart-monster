import { action } from "@/lib/api";
export function updateGame(args: {
  bggId: number;
  category: "board" | "party";
  minPlayers: number | null;
  maxPlayers: number | null;
  playingTime: number | null;
}) {
  return action("updateGame", args);
}
