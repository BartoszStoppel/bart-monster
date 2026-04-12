export type UserRole = "admin" | "coadmin" | null;

interface RoleBadgeProps {
  role: UserRole;
}

/**
 * Tiny pill showing GM (Game Master / admin) or DM (Dungeon Master / co-admin).
 */
export function RoleBadge({ role }: RoleBadgeProps) {
  if (!role) return null;

  const config = role === "admin"
    ? { label: "GM", title: "Game Master — Admin", style: "bg-amber-200 text-amber-900 dark:bg-amber-800/40 dark:text-amber-200" }
    : { label: "DM", title: "Dungeon Master — Co-Admin", style: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300" };

  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 text-[10px] font-bold leading-4 ${config.style}`}
      title={config.title}
    >
      {config.label}
    </span>
  );
}
