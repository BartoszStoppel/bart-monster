"use client";

import { useRef, useEffect, useCallback } from "react";

const SEGMENT_COLORS = [
  "#ef4444", "#f97316", "#eab308", "#22c55e",
  "#06b6d4", "#3b82f6", "#8b5cf6", "#ec4899",
  "#14b8a6", "#f43f5e",
];

export interface WheelSegment {
  label: string;
  weight: number;
}

interface SpinnerWheelProps {
  segments: WheelSegment[];
  spinning: boolean;
  targetIndex: number | null;
  onSpinComplete: () => void;
}

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function SpinnerWheel({
  segments,
  spinning,
  targetIndex,
  onSpinComplete,
}: SpinnerWheelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const angleRef = useRef(0);
  const animRef = useRef<number | null>(null);
  const spinningRef = useRef(false);

  const totalWeight = segments.reduce((s, seg) => s + seg.weight, 0);

  const drawWheel = useCallback(
    (ctx: CanvasRenderingContext2D, size: number, rotation: number) => {
      const cx = size / 2;
      const cy = size / 2;
      const radius = size / 2 - 4;

      ctx.clearRect(0, 0, size, size);

      if (segments.length === 0) {
        ctx.fillStyle = "#27272a";
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#71717a";
        ctx.font = `${size * 0.04}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("No games in pool", cx, cy);
        return;
      }

      let startAngle = rotation;

      for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const sliceAngle = (seg.weight / totalWeight) * Math.PI * 2;
        const endAngle = startAngle + sliceAngle;

        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fillStyle = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.15)";
        ctx.lineWidth = 1;
        ctx.stroke();

        // Draw label
        const midAngle = startAngle + sliceAngle / 2;
        const labelRadius = radius * 0.65;
        const lx = cx + Math.cos(midAngle) * labelRadius;
        const ly = cy + Math.sin(midAngle) * labelRadius;

        ctx.save();
        ctx.translate(lx, ly);
        ctx.rotate(midAngle);
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${Math.max(size * 0.028, 10)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = "rgba(0,0,0,0.5)";
        ctx.shadowBlur = 2;
        const maxChars = Math.max(8, Math.floor((sliceAngle * radius) / (size * 0.03)));
        const label =
          seg.label.length > maxChars
            ? seg.label.slice(0, maxChars - 1) + "…"
            : seg.label;
        ctx.fillText(label, 0, 0);
        ctx.restore();

        startAngle = endAngle;
      }

      // Center circle
      ctx.beginPath();
      ctx.arc(cx, cy, radius * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = "#18181b";
      ctx.fill();
      ctx.strokeStyle = "#3f3f46";
      ctx.lineWidth = 2;
      ctx.stroke();
    },
    [segments, totalWeight]
  );

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const size = Math.floor(rect.width);
    const dpr = window.devicePixelRatio || 1;

    canvas.width = size * dpr;
    canvas.height = size * dpr;
    canvas.style.width = `${size}px`;
    canvas.style.height = `${size}px`;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    drawWheel(ctx, size, angleRef.current);
  }, [drawWheel]);

  // Resize observer
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      if (!spinningRef.current) render();
    });
    observer.observe(container);
    render();

    return () => observer.disconnect();
  }, [render]);

  // Spin animation
  useEffect(() => {
    if (!spinning || targetIndex == null || segments.length === 0) return;

    spinningRef.current = true;

    // Calculate target angle: the pointer is at the top (- PI/2)
    // We need the target segment's midpoint to end up at the top
    let angleToTarget = 0;
    for (let i = 0; i < targetIndex; i++) {
      angleToTarget += (segments[i].weight / totalWeight) * Math.PI * 2;
    }
    angleToTarget += (segments[targetIndex].weight / totalWeight) * Math.PI;

    // The wheel rotates, pointer is fixed at top (-PI/2)
    // We want: rotation + angleToTarget ≡ -PI/2 (mod 2PI)
    // So final rotation = -PI/2 - angleToTarget
    const extraSpins = (10 + Math.floor(Math.random() * 6)) * Math.PI * 2;
    const finalAngle = -Math.PI / 2 - angleToTarget + extraSpins;

    const startAngle = angleRef.current;
    const totalSpin = finalAngle - startAngle;
    const duration = 7000;
    const startTime = performance.now();

    function animate(now: number) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeOutCubic(progress);

      angleRef.current = startAngle + totalSpin * eased;

      render();

      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        spinningRef.current = false;
        animRef.current = null;
        onSpinComplete();
      }
    }

    animRef.current = requestAnimationFrame(animate);

    return () => {
      if (animRef.current != null) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
  }, [spinning, targetIndex, segments, totalWeight, render, onSpinComplete]);

  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* Pointer */}
      <div className="absolute top-0 left-1/2 z-10 -translate-x-1/2 -translate-y-1">
        <svg width="24" height="28" viewBox="0 0 24 28" fill="none">
          <path d="M12 28L2 4L12 10L22 4L12 28Z" fill="#18181b" stroke="#3f3f46" strokeWidth="1" />
        </svg>
      </div>
      <div ref={containerRef} className="aspect-square w-full">
        <canvas ref={canvasRef} />
      </div>
    </div>
  );
}
