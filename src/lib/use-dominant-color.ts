"use client";

import { useEffect, useState } from "react";

const colorCache = new Map<string, string>();

function extractColor(img: HTMLImageElement): string | null {
  const canvas = document.createElement("canvas");
  canvas.width = 4;
  canvas.height = 4;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;

  ctx.drawImage(img, 0, 0, 4, 4);
  const { data } = ctx.getImageData(0, 0, 4, 4);

  let r = 0,
    g = 0,
    b = 0,
    count = 0;
  for (let i = 0; i < data.length; i += 4) {
    const pr = data[i];
    const pg = data[i + 1];
    const pb = data[i + 2];
    const brightness = (pr + pg + pb) / 3;
    if (brightness > 30 && brightness < 225) {
      r += pr;
      g += pg;
      b += pb;
      count++;
    }
  }

  if (count === 0) {
    for (let i = 0; i < data.length; i += 4) {
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
  }

  if (count === 0) return null;
  return `${Math.round(r / count)}, ${Math.round(g / count)}, ${Math.round(b / count)}`;
}

/**
 * Extracts the dominant color from an image URL using a tiny canvas.
 * Loads a small proxy image via /_next/image to avoid CORS issues.
 * @returns An "r, g, b" string, or null while loading/on failure.
 */
export function useDominantColor(imageUrl: string | null): string | null {
  const [color, setColor] = useState<string | null>(
    imageUrl ? (colorCache.get(imageUrl) ?? null) : null,
  );

  useEffect(() => {
    if (!imageUrl) return;
    if (colorCache.has(imageUrl)) return;

    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = `/_next/image?url=${encodeURIComponent(imageUrl)}&w=32&q=75`;

    img.onload = () => {
      try {
        const result = extractColor(img);
        if (result) {
          colorCache.set(imageUrl, result);
          setColor(result);
        }
      } catch (err) {
        console.warn("[useDominantColor] extraction failed:", err);
      }
    };

    img.onerror = () => {
      console.warn("[useDominantColor] failed to load proxy image for:", imageUrl);
    };
  }, [imageUrl]);

  return color;
}
