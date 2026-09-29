import { action } from "@/lib/api";
export function setUserAdmin(targetUserId: string, newValue: boolean) {
  return action("setUserAdmin", { targetUserId, newValue });
}
