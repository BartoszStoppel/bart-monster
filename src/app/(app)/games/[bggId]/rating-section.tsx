"use client";

import { useRouter } from "next/navigation";
import { RatingForm } from "@/components/rating-form";
import type { GameRatingWithProfile } from "@/types/database";

interface RatingSectionProps {
  bggId: number;
  ratings: GameRatingWithProfile[];
  userRating: GameRatingWithProfile | null;
}

export function RatingSection({ bggId, ratings, userRating }: RatingSectionProps) {
  const router = useRouter();

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {userRating ? "Update Your Rating" : "Rate This Game"}
      </h2>

      <RatingForm
        bggId={bggId}
        existingRating={userRating?.rating}
        existingComment={userRating?.comment}
        onRated={() => router.refresh()}
      />

      {ratings.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
            Community Ratings
          </h2>
          <div className="space-y-3">
            {ratings.map((r) => (
              <div
                key={r.id}
                className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                    {r.profiles?.display_name ?? "Unknown"}
                  </span>
                  <span className="rounded bg-blue-100 px-2 py-0.5 text-sm font-bold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {r.rating}/10
                  </span>
                </div>
                {r.comment && (
                  <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                    {r.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
