import { action } from "@/lib/api";
export async function deleteGame(bggId: number) {
  await action("deleteGame", { bggId }, false);
  window.location.assign("/");
}
