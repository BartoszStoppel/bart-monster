"use client";

import { useState, useTransition } from "react";
import { submitFeedback } from "./actions";
import type { FeedbackCategory } from "@/types/database";

const CATEGORIES: { value: FeedbackCategory; label: string }[] = [
  { value: "feature", label: "Feature request" },
  { value: "bug", label: "Bug report" },
  { value: "improvement", label: "Improvement" },
];

export function SubmitFeedbackForm() {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<FeedbackCategory>("feature");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await submitFeedback(title, description, category);
        setTitle("");
        setDescription("");
        setCategory("feature");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="fb-title"
          className="mb-1 block font-stat text-xs uppercase tracking-wide text-on-surface-variant"
        >
          Title
        </label>
        <input
          id="fb-title"
          type="text"
          required
          maxLength={200}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Short summary..."
          className="carved-input w-full rounded-lg px-3 py-2 text-sm placeholder:text-on-surface-variant/60 focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="fb-description"
          className="mb-1 block font-stat text-xs uppercase tracking-wide text-on-surface-variant"
        >
          Description
        </label>
        <textarea
          id="fb-description"
          required
          rows={3}
          maxLength={2000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe what you'd like or what's broken..."
          className="carved-input w-full rounded-lg px-3 py-2 text-sm placeholder:text-on-surface-variant/60 focus:outline-none"
        />
      </div>

      <div>
        <label
          htmlFor="fb-category"
          className="mb-1 block font-stat text-xs uppercase tracking-wide text-on-surface-variant"
        >
          Category
        </label>
        <select
          id="fb-category"
          value={category}
          onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
          className="carved-input w-full rounded-lg px-3 py-2 text-sm focus:outline-none"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <p className="text-sm text-error">{error}</p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="stone-button flex items-center gap-2 rounded-lg px-4 py-2 font-stat text-stat-label disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[18px]">send</span>
        {isPending ? "Submitting..." : "Submit"}
      </button>
    </form>
  );
}
