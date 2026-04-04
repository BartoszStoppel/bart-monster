import { SupabaseClient } from "@supabase/supabase-js";
import {
  type AchievementDisplay,
  type AchievementHolder,
  type ProfileMap,
  topByDistinctValues,
} from "./computed-achievements";

function formatDuration(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export async function computeActivityAchievements(
  supabase: SupabaseClient,
  profileMap: ProfileMap
): Promise<AchievementDisplay[]> {
  const { data: activity } = await supabase
    .from("user_activity")
    .select("user_id, visit_count, total_seconds");

  if (!activity?.length) return [];

  const visitsByUser = new Map<string, number>();
  const secondsByUser = new Map<string, number>();

  for (const row of activity) {
    visitsByUser.set(row.user_id, row.visit_count);
    secondsByUser.set(row.user_id, row.total_seconds);
  }

  function toHolders(
    entries: [string, number][],
    formatFn: (val: number) => string
  ): AchievementHolder[] {
    return entries.map(([userId, val]) => {
      const profile = profileMap.get(userId);
      return {
        display_name: profile?.display_name ?? "Unknown",
        avatar_url: profile?.avatar_url ?? null,
        detail: formatFn(val),
        category_label: null,
      };
    });
  }

  const achievements: AchievementDisplay[] = [];

  const sortedVisits: [string, number][] = [...visitsByUser.entries()]
    .sort((a, b) => b[1] - a[1]);
  const topVisits = topByDistinctValues(sortedVisits, 3);
  if (topVisits.length > 0) {
    achievements.push({
      title: "Most Dedicated",
      description: "Most visits to the site",
      icon: "🏠",
      ranked: true,
      holders: toHolders(topVisits, (v) => `${v} ${v === 1 ? "visit" : "visits"}`),
    });
  }

  const sortedTime: [string, number][] = [...secondsByUser.entries()]
    .sort((a, b) => b[1] - a[1]);
  const topTime = topByDistinctValues(sortedTime, 3);
  if (topTime.length > 0) {
    achievements.push({
      title: "Time Lord",
      description: "Most time spent on the site",
      icon: "⏱️",
      ranked: true,
      holders: toHolders(topTime, formatDuration),
    });
  }

  return achievements;
}
