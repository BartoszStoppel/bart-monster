"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
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

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      className={`h-3 w-3 transition-transform ${open ? "rotate-180" : ""}`}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

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
    <div className="absolute left-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          onClick={onClose}
          className={`block px-4 py-2 text-sm transition-colors ${
            pathname === link.href
              ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-700 dark:text-zinc-50"
              : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
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
  onEnter,
  onLeave,
}: {
  group: NavGroup;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const isActive = group.links.some((l) => pathname === l.href);

  return (
    <div className="relative" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        onClick={onToggle}
        className={`flex items-center gap-1 rounded-md px-2 py-1.5 text-sm font-medium transition-all ${
          isOpen
            ? "bg-zinc-100 text-zinc-900 dark:bg-white/10 dark:text-zinc-50"
            : isActive
              ? "text-zinc-900 hover:bg-zinc-100 dark:text-zinc-50 dark:hover:bg-white/10"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-zinc-50"
        }`}
      >
        {group.label}
        <Chevron open={isOpen} />
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
  pathname,
  isOpen,
  onToggle,
  onClose,
  onSignOut,
  onEnter,
  onLeave,
}: {
  user: User;
  pathname: string;
  isOpen: boolean;
  onToggle: () => void;
  onClose: () => void;
  onSignOut: () => void;
  onEnter: () => void;
  onLeave: () => void;
}) {
  const avatarUrl = user.user_metadata.avatar_url as string | undefined;

  return (
    <div className="relative shrink-0 pl-4" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        onClick={onToggle}
        className={`flex items-center gap-2 rounded-md px-2 py-1.5 transition-all ${
          isOpen
            ? "bg-zinc-100 dark:bg-white/10"
            : "hover:bg-zinc-100 dark:hover:bg-white/10"
        }`}
      >
        <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:block">
          {user.user_metadata.full_name ?? user.email}
        </span>
        {avatarUrl ? (
          <Image
            src={avatarUrl}
            alt=""
            width={28}
            height={28}
            className="rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300">
            {(user.user_metadata.full_name ?? user.email ?? "?")
              .charAt(0)
              .toUpperCase()}
          </div>
        )}
      </button>

      {isOpen && (
        <DropdownPanel
          links={PROFILE_LINKS}
          pathname={pathname}
          onClose={onClose}
          footer={
            <>
              <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
              <button
                onClick={onSignOut}
                className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
              >
                Sign out
              </button>
            </>
          }
        />
      )}
    </div>
  );
}

export function Nav() {
  const pathname = usePathname();
  const [user, setUser] = useState<User | null>(null);
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  useEffect(() => {
    if (!openGroup) return;
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [openGroup]);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  function toggle(key: string) {
    setOpenGroup((prev) => (prev === key ? null : key));
  }

  function close() {
    setOpenGroup(null);
  }

  function handleEnter(key: string) {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setOpenGroup(key);
  }

  function handleLeave() {
    hoverTimer.current = setTimeout(() => setOpenGroup(null), 150);
  }

  return (
    <nav
      ref={navRef}
      className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80"
    >
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4">
        <div className="flex items-center gap-4 sm:gap-6">
          {NAV_GROUPS.map((group) => (
            <NavGroupButton
              key={group.label}
              group={group}
              pathname={pathname}
              isOpen={openGroup === group.label}
              onToggle={() => toggle(group.label)}
              onClose={close}
              onEnter={() => handleEnter(group.label)}
              onLeave={handleLeave}
            />
          ))}
        </div>

        {user && (
          <AvatarMenu
            user={user}
            pathname={pathname}
            isOpen={openGroup === "__profile"}
            onToggle={() => toggle("__profile")}
            onClose={close}
            onSignOut={handleSignOut}
            onEnter={() => handleEnter("__profile")}
            onLeave={handleLeave}
          />
        )}
      </div>
    </nav>
  );
}
