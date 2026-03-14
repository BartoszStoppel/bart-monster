"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useEffect, useState, useRef, useCallback } from "react";
import type { User } from "@supabase/supabase-js";

const NAV_LINKS = [
  { href: "/", label: "Collection" },
  { href: "/tier-list", label: "Tier List" },
  { href: "/community", label: "Community" },
  { href: "/achievements", label: "Achievements" },
  { href: "/statistics", label: "Statistics" },
  { href: "/profile", label: "Profile" },
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

        {/* User info */}
        {user && (
          <div className="flex shrink-0 items-center gap-3 pl-4">
            <span className="hidden text-sm text-zinc-500 dark:text-zinc-400 sm:block">
              {user.user_metadata.full_name ?? user.email}
            </span>
            <button
              onClick={handleSignOut}
              className="text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}
