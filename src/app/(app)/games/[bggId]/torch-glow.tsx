"use client";

import { useEffect, useRef } from "react";

/**
 * Atmospheric torch that follows the cursor (design/code-detail.html). Renders
 * a single fixed bloom and moves it with a direct style write — no React state,
 * so pointer moves don't trigger re-renders. Hidden via CSS under
 * prefers-reduced-motion.
 */
export function TorchGlow() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
      // Offset by half the bloom size (300px) so it centres on the pointer.
      el.style.transform = `translate(${e.clientX - 150}px, ${e.clientY - 150}px)`;
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, []);

  return <div ref={ref} className="torch-glow hidden md:block" aria-hidden="true" />;
}
