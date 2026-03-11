"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface RatingFormProps {
  bggId: number;
  existingRating?: number | null;
  existingComment?: string | null;
  onRated?: () => void;
}

export function RatingForm({
  bggId,
  existingRating,
  existingComment,
  onRated,
}: RatingFormProps) {
  const [rating, setRating] = useState(existingRating ?? 0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState(existingComment ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rating < 1 || rating > 10) return;

    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setSaving(false);
      return;
    }

    await supabase.from("game_ratings").upsert(
      {
        user_id: user.id,
        bgg_id: bggId,
        rating,
        comment: comment.trim() || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,bgg_id" }
    );

    setSaving(false);
    onRated?.();
  }

  const displayRating = hoveredRating || rating;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3">
      <div className="flex items-center gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRating(value)}
            onMouseEnter={() => setHoveredRating(value)}
            onMouseLeave={() => setHoveredRating(0)}
            className={`flex h-8 w-8 items-center justify-center rounded text-sm font-medium transition-colors ${
              value <= displayRating
                ? "bg-blue-600 text-white"
                : "bg-zinc-100 text-zinc-400 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-500 dark:hover:bg-zinc-700"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Add a comment (optional)"
        rows={2}
        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
      />

      <button
        type="submit"
        disabled={rating < 1 || saving}
        className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving..." : existingRating ? "Update Rating" : "Submit Rating"}
      </button>
    </form>
  );
}
