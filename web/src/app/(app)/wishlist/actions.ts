import { action } from "@/lib/api";
export function moveToOwned(bggId: number) {
  return action("moveToOwned", { bggId });
}
export function removeFromWishlist(bggId: number) {
  return action("removeFromWishlist", { bggId });
}
export function addToWishlist(bggId: number) {
  return action("addToWishlist", { bggId });
}
