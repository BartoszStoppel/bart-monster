"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef, useCallback } from "react";
import type { User } from "@supabase/supabase-js";

const NAV_LINKS = [
  { href: "/", label: "Collection" },
  { href: "/picker", label: "Picker" },
  { href: "/community", label: "Community" },
  { href: "/achievements", label: "Achievements" },
  { href: "/furtch", label: "Furtch" },
  { href: "/statistics", label: "Statistics" },
  { href: "/chat", label: "Chat" },
];

function useActiveIndicator(pathname: string) {
  const containerRef = useRef<HTMLDivElement>(null);
  const linkRefs = useRef<Map<string, HTMLAnchorElement>>(new Map());
  const [style, setStyle] = useState<{ left: number; width: number }>({ left: 0, width: 0 });

  const measure = useCallback(() => {
    const container = containerRef.current;
    const activeEl = linkRefs.current.get(pathname);
    if (container && activeEl) {
      const containerRect = container.getBoundingClientRect();
      const elRect = activeEl.getBoundingClientRect();
      setStyle({
        left: elRect.left - containerRect.left,
        width: elRect.width,
      });
    }
  }, [pathname]);

  useEffect(() => {
    measure();
  }, [measure]);

  const setLinkRef = useCallback((href: string, el: HTMLAnchorElement | null) => {
    if (el) {
      linkRefs.current.set(href, el);
    }
  }, []);

  return { containerRef, setLinkRef, indicatorStyle: style };
}

const AVATAR_MENU_LINKS = [
  { href: "/profile", label: "Profile" },
  { href: "/wishlist", label: "Wishlist" },
  { href: "/tier-list", label: "Edit Tier List" },
  { href: "/feedback", label: "Feedback" },
];

function AvatarMenu({
  user,
  onSignOut,
}: {
  user: User;
  onSignOut: () => void;
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const avatarUrl = user.user_metadata.avatar_url as string | undefined;

  return (
    <div ref={menuRef} className="relative shrink-0 pl-4">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex items-center gap-2"
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

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 min-w-[160px] rounded-lg border border-zinc-200 bg-white py-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          {AVATAR_MENU_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
            >
              {link.label}
            </Link>
          ))}
          <div className="my-1 border-t border-zinc-200 dark:border-zinc-700" />
          <button
            onClick={onSignOut}
            className="block w-full px-4 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
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
  const [user, setUser] = useState<User | null>(null);
  const { containerRef, setLinkRef, indicatorStyle } = useActiveIndicator(pathname);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setUser(data.user));
  }, []);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <nav className="sticky top-0 z-50 border-b border-zinc-200 bg-white/80 backdrop-blur-sm dark:border-zinc-800 dark:bg-zinc-900/80">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4">
        {/* Tabs */}
        <div
          ref={containerRef}
          className="relative flex items-center gap-4 overflow-x-auto sm:gap-6"
        >
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              ref={(el) => setLinkRef(link.href, el)}
              href={link.href}
              className={`whitespace-nowrap py-3 text-sm font-medium transition-colors ${
                pathname === link.href
                  ? "text-zinc-900 dark:text-zinc-50"
                  : "text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              {link.label}
            </Link>
          ))}
          <div
            className="absolute bottom-0 h-0.5 rounded-full bg-zinc-900 transition-all duration-200 ease-in-out dark:bg-zinc-50"
            style={{ left: indicatorStyle.left, width: indicatorStyle.width }}
          />
        </div>

        {/* Avatar dropdown */}
        {user && (
          <AvatarMenu user={user} onSignOut={handleSignOut} />
        )}
      </div>
    </nav>
  );
}
