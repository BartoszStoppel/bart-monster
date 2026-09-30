"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef } from "react";
import type { User } from "@supabase/supabase-js";

interface NavLink {
  href: string;
  label: string;
}

interface NavGroup {
  label: string;
  links: NavLink[];
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Games",
    links: [
      { href: "/", label: "Collection" },
      { href: "/picker", label: "Picker" },
      { href: "/wishlist", label: "Wishlist" },
    ],
  },
  {
    label: "Rankings",
    links: [
      { href: "/tier-list", label: "Tier List" },
      { href: "/community", label: "Community" },
      { href: "/statistics", label: "Statistics" },
    ],
  },
  {
    label: "Social",
    links: [
      { href: "/chat", label: "AI Chat" },
      { href: "/achievements", label: "Achievements" },
      { href: "/furtch", label: "Furtch" },
    ],
  },
];

const PROFILE_LINKS: NavLink[] = [
  { href: "/profile", label: "Profile" },
  { href: "/feedback", label: "Feedback" },
];

const ADMIN_LINKS: NavLink[] = [{ href: "/admin", label: "Admin" }];

function DropdownPanel({
  links,
  pathname,
  onClose,
  footer,
}: {
  links: NavLink[];
  pathname: string;
  onClose: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <div className="absolute left-0 top-full z-50 mt-2 min-w-[180px] rounded-lg border border-outline-variant bg-surface-container-high py-1 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onClose}
          className={`block px-4 py-2 font-stat text-stat-label transition-colors ${
            pathname === link.href
              ? "bg-surface-container-highest text-primary"
              : "text-on-surface-variant hover:bg-surface-container-highest hover:text-primary-container"
          }`}
        >
          {link.label}
        </Link>
      ))}
      {footer}
    </div>
  );
}

function NavGroupButton({
  group,
  pathname,
  isOpen,
  onToggle,
  onClose,
  onPointerEnter,
  onPointerLeave,
}: {
  group: NavGroup;
  pathname: string;
  isOpen: boolean;
  onToggle: React.MouseEventHandler<HTMLButtonElement>;
  onClose: () => void;
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
}) {
  const isActive = group.links.some((l) => pathname === l.href);

  return (
    <div
      className="relative"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onBlur={(event) => {
        if (isOpen && !event.currentTarget.contains(event.relatedTarget))
          onClose();
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        className={`flex items-center gap-1 font-body text-sm font-medium transition-colors active:scale-95 ${
          isOpen || isActive
            ? "text-primary"
            : "text-on-surface-variant hover:text-primary-container"
        }`}
      >
        {group.label}
        <span
          aria-hidden="true"
          className={`material-symbols-outlined text-[18px] transition-transform ${isOpen ? "rotate-180" : ""}`}
        >
          expand_more
        </span>
      </button>

      {isOpen && (
        <DropdownPanel
          links={group.links}
          pathname={pathname}
          onClose={onClose}
        />
      )}
    </div>
  );
}

function AvatarMenu({
  user,
  links,
  pathname,
  isOpen,
  onToggle,
  onClose,
  onSignOut,
  onPointerEnter,
  onPointerLeave,
}: {
  user: User;
  links: NavLink[];
  pathname: string;
  isOpen: boolean;
  onToggle: React.MouseEventHandler<HTMLButtonElement>;
  onClose: () => void;
  onSignOut: () => void;
  onPointerEnter: (e: React.PointerEvent) => void;
  onPointerLeave: (e: React.PointerEvent) => void;
}) {
  const avatarUrl = user.user_metadata.avatar_url as string | undefined;

  return (
    <div
      className="relative shrink-0"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
      onBlur={(event) => {
        if (isOpen && !event.currentTarget.contains(event.relatedTarget))
          onClose();
      }}
    >
      <button
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-label="Account menu"
        className="flex items-center gap-2 rounded-full bg-surface-container-highest p-1 text-primary transition-all hover:text-primary-container active:scale-95"
        title={user.user_metadata.full_name ?? user.email ?? "Account"}
      >
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span
            aria-hidden="true"
            className="material-symbols-outlined p-1 text-[24px]"
          >
            account_circle
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 min-w-[180px] rounded-lg border border-outline-variant bg-surface-container-high py-1 shadow-[0_10px_30px_-10px_rgba(0,0,0,0.7)]">
          <div className="border-b border-outline-variant px-4 py-2 font-caption text-caption text-on-surface-variant">
            {user.user_metadata.full_name ?? user.email}
          </div>
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className={`block px-4 py-2 font-stat text-stat-label transition-colors ${
                pathname === link.href
                  ? "bg-surface-container-highest text-primary"
                  : "text-on-surface-variant hover:bg-surface-container-highest hover:text-primary-container"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div className="my-1 border-t border-outline-variant" />
          <button
            onClick={onSignOut}
            className="block w-full px-4 py-2 text-left font-stat text-stat-label text-on-surface-variant transition-colors hover:bg-surface-container-highest hover:text-tertiary"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [user, setUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(null);
  const openedByHover = useRef(false);

  useEffect(() => () => clearTimeout(hoverTimer.current), []);

  useEffect(() => {
    const supabase = createClient();
    const load = () =>
      supabase.auth
        .getUser()
        .then(async ({ data }) => {
          setUser(data.user);
          if (!data.user) return;
          const { data: profile } = await supabase
            .from("profiles")
            .select("is_admin")
            .eq("id", data.user.id)
            .single();
          setIsAdmin(profile?.is_admin === true);
        })
        .catch(() => {});
    void load();
    window.addEventListener("bart:identity", load);
    return () => window.removeEventListener("bart:identity", load);
  }, []);

  const profileLinks = isAdmin
    ? [...PROFILE_LINKS, ...ADMIN_LINKS]
    : PROFILE_LINKS;

  useEffect(() => {
    if (!openGroup) return;
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key !== "Escape") return;
      const trigger = navRef.current?.querySelector<HTMLButtonElement>(
        'button[aria-expanded="true"]',
      );
      setOpenGroup(null);
      trigger?.focus();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [openGroup]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function toggle(key: string, event: React.MouseEvent<HTMLButtonElement>) {
    const keepOpen =
      event.detail > 0 && openedByHover.current && openGroup === key;
    openedByHover.current = false;
    setOpenGroup(keepOpen ? key : openGroup === key ? null : key);
  }

  function close() {
    openedByHover.current = false;
    clearTimeout(hoverTimer.current);
    setOpenGroup(null);
  }

  function handlePointerEnter(key: string, e: React.PointerEvent) {
    if (e.pointerType === "touch") return;
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    openedByHover.current = true;
    setOpenGroup(key);
  }

  function handlePointerLeave(e: React.PointerEvent) {
    if (
      e.pointerType === "touch" ||
      e.currentTarget.contains(document.activeElement)
    )
      return;
    const group = e.currentTarget;
    hoverTimer.current = setTimeout(() => {
      if (!group.contains(document.activeElement)) setOpenGroup(null);
    }, 150);
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    close();
    router.push(`/search?q=${encodeURIComponent(search.trim())}`);
  }

  return (
    <nav
      ref={navRef}
      onFocusCapture={() => clearTimeout(hoverTimer.current)}
      className="sticky top-0 z-50 border-b border-outline-variant bg-surface-container-high/95 shadow-md backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-4 px-4 py-4 md:px-margin">
        <div className="contents lg:flex lg:items-center lg:gap-gutter">
          <Link
            href="/"
            onClick={close}
            className="font-display text-xl font-bold tracking-tighter text-primary sm:text-2xl"
          >
            TABLE MONSTERS
          </Link>
          <div className="order-last flex w-full items-center gap-6 lg:order-none lg:ml-4 lg:w-auto">
            {NAV_GROUPS.map((group) => (
              <NavGroupButton
                key={group.label}
                group={group}
                pathname={pathname}
                isOpen={openGroup === group.label}
                onToggle={(event) => toggle(group.label, event)}
                onClose={close}
                onPointerEnter={(e) => handlePointerEnter(group.label, e)}
                onPointerLeave={handlePointerLeave}
              />
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSearch} className="relative hidden sm:block">
            <span
              aria-hidden="true"
              className="material-symbols-outlined pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-on-surface-variant"
            >
              search
            </span>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="carved-input w-48 rounded-full py-2 pl-10 pr-4 font-body text-sm lg:w-64"
              placeholder="Search the archives..."
              aria-label="Search the archives"
              type="text"
            />
          </form>

          {user && (
            <AvatarMenu
              user={user}
              links={profileLinks}
              pathname={pathname}
              isOpen={openGroup === "__profile"}
              onToggle={(event) => toggle("__profile", event)}
              onClose={close}
              onSignOut={handleSignOut}
              onPointerEnter={(e) => handlePointerEnter("__profile", e)}
              onPointerLeave={handlePointerLeave}
            />
          )}
        </div>
      </div>
    </nav>
  );
}
