import { SupabaseClient } from "@supabase/supabase-js";
import {
  type AchievementDisplay,
  type AchievementHolder,
  type ProfileMap,
  buildHouseholdMap,
  buildUserToHouseholdMap,
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

  const householdMap = buildHouseholdMap(profileMap);
  const userToHousehold = buildUserToHouseholdMap(profileMap);

  const visitsByHousehold = new Map<string, number>();
  const secondsByHousehold = new Map<string, number>();

  for (const row of activity) {
    const hhId = userToHousehold.get(row.user_id) ?? row.user_id;
    visitsByHousehold.set(hhId, (visitsByHousehold.get(hhId) ?? 0) + row.visit_count);
    secondsByHousehold.set(hhId, (secondsByHousehold.get(hhId) ?? 0) + row.total_seconds);
  }

  function toHolders(
    entries: [string, number][],
    formatFn: (val: number) => string
  ): AchievementHolder[] {
    return entries.map(([hhId, val]) => {
      const household = householdMap.get(hhId);
      return {
        display_name: household?.display_name ?? "Unknown",
        avatar_url: household?.avatar_urls[0] ?? null,
        avatar_urls: household?.avatar_urls ?? [],
        detail: formatFn(val),
        category_label: null,
      };
    });
  }

  const achievements: AchievementDisplay[] = [];

  const sortedVisits: [string, number][] = [...visitsByHousehold.entries()]
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

  const sortedTime: [string, number][] = [...secondsByHousehold.entries()]
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
