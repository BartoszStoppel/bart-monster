"use client";

import { useState, useTransition } from "react";
import { updateFeedbackStatus, deleteFeedback } from "./actions";
import type {
  FeedbackItemWithProfile,
  FeedbackStatus,
} from "@/types/database";

const STATUS_OPTIONS: { value: FeedbackStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "planned", label: "Planned" },
  { value: "in-progress", label: "In Progress" },
  { value: "done", label: "Done" },
  { value: "declined", label: "Declined" },
];

const STATUS_COLORS: Record<FeedbackStatus, string> = {
  new: "bg-zinc-100 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300",
  planned: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  "in-progress":
    "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
  done: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
  declined: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
};

const CATEGORY_COLORS: Record<string, string> = {
  feature: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
  bug: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
  improvement:
    "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300",
};

function FeedbackCard({
  item,
  isAdmin,
  isOwner,
}: {
  item: FeedbackItemWithProfile;
  isAdmin: boolean;
  isOwner: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [editingStatus, setEditingStatus] = useState(false);
  const [newStatus, setNewStatus] = useState<FeedbackStatus>(item.status);
  const [adminNote, setAdminNote] = useState(item.admin_note ?? "");

  function handleStatusSave() {
    startTransition(async () => {
      await updateFeedbackStatus(item.id, newStatus, adminNote);
      setEditingStatus(false);
    });
  }

  function handleDelete() {
    startTransition(async () => {
      await deleteFeedback(item.id);
    });
  }

  const date = new Date(item.created_at).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-800">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900 dark:text-zinc-50">
          {item.title}
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_COLORS[item.category] ?? ""}`}
          >
            {item.category}
          </span>
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[item.status]}`}
          >
            {item.status}
          </span>
        </div>
      </div>

      <p className="mb-3 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
        {item.description}
      </p>

      {item.admin_note && !editingStatus && (
        <p className="mb-3 rounded border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-300">
          <span className="font-medium">Admin note:</span> {item.admin_note}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400">
        <span>
          {item.profiles.display_name} &middot; {date}
        </span>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setEditingStatus(!editingStatus)}
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              {editingStatus ? "Cancel" : "Edit status"}
            </button>
          )}
          {isOwner && item.status === "new" && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {editingStatus && (
        <div className="mt-3 space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <label
              htmlFor={`status-${item.id}`}
              className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Status
            </label>
            <select
              id={`status-${item.id}`}
              value={newStatus}
              onChange={(e) =>
                setNewStatus(e.target.value as FeedbackStatus)
              }
              className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor={`note-${item.id}`}
              className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Admin note (optional)
            </label>
            <input
              id={`note-${item.id}`}
              type="text"
              maxLength={500}
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Add a note..."
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <button
            onClick={handleStatusSave}
            disabled={isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}

export function FeedbackList({
  items,
  isAdmin,
  userId,
}: {
  items: FeedbackItemWithProfile[];
  isAdmin: boolean;
  userId: string;
}) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No feedback yet. Be the first to submit!
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {items.map((item) => (
        <FeedbackCard
          key={item.id}
          item={item}
          isAdmin={isAdmin}
          isOwner={item.user_id === userId}
        />
      ))}
    </div>
  );
}
