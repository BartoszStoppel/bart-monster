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
    ? { label: "GM", title: "Game Master — Admin", style: "bg-primary-container text-on-primary-container" }
    : { label: "DM", title: "Dungeon Master — Co-Admin", style: "bg-surface-container-highest text-on-surface-variant" };

  return (
    <span
      className={`inline-flex items-center rounded-full px-1.5 text-[10px] font-bold leading-4 ${config.style}`}
      title={config.title}
    >
      {config.label}
    </span>
  );
}
