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
  new: "bg-surface-container-highest text-on-surface-variant",
  planned: "bg-tertiary-container/15 text-tertiary",
  "in-progress":
    "bg-primary-container/15 text-primary",
  done: "bg-secondary-container/15 text-secondary",
  declined: "bg-error-container/15 text-error",
};

const CATEGORY_COLORS: Record<string, string> = {
  feature: "bg-primary-container/15 text-primary",
  bug: "bg-error-container/15 text-error",
  improvement:
    "bg-secondary-container/15 text-secondary",
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
    timeZone: "UTC",
  });

  return (
    <div className="monster-card rounded-lg p-card-padding">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-2">
        <h3 className="font-display text-headline-lg-mobile text-on-surface">
          {item.title}
        </h3>
        <div className="flex items-center gap-2">
          <span
            className={`inline-block rounded-full border border-outline-variant px-2 py-0.5 font-stat text-[11px] uppercase tracking-wide ${CATEGORY_COLORS[item.category] ?? ""}`}
          >
            {item.category}
          </span>
          <span
            className={`inline-block rounded-full border border-outline-variant px-2 py-0.5 font-stat text-[11px] uppercase tracking-wide ${STATUS_COLORS[item.status]}`}
          >
            {item.status}
          </span>
        </div>
      </div>

      <p className="mb-3 whitespace-pre-wrap text-sm text-on-surface-variant">
        {item.description}
      </p>

      {item.admin_note && !editingStatus && (
        <p className="mb-3 rounded border border-primary bg-primary-container/10 px-3 py-2 text-sm text-primary">
          <span className="font-medium">Admin note:</span> {item.admin_note}
        </p>
      )}

      <div className="flex items-center justify-between text-xs text-on-surface-variant">
        <span>
          {item.profiles.display_name} &middot; {date}
        </span>

        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              onClick={() => setEditingStatus(!editingStatus)}
              className="text-primary hover:underline"
            >
              {editingStatus ? "Cancel" : "Edit status"}
            </button>
          )}
          {isOwner && item.status === "new" && (
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="text-error hover:underline disabled:opacity-50"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      {editingStatus && (
        <div className="mt-3 space-y-3 border-t border-outline-variant pt-3">
          <div className="flex items-center gap-3">
            <label
              htmlFor={`status-${item.id}`}
              className="text-sm font-medium text-on-surface-variant"
            >
              Status
            </label>
            <select
              id={`status-${item.id}`}
              value={newStatus}
              onChange={(e) =>
                setNewStatus(e.target.value as FeedbackStatus)
              }
              className="carved-input rounded-lg px-2 py-1 text-sm"
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
              className="mb-1 block text-sm font-medium text-on-surface-variant"
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
              className="carved-input w-full rounded-lg px-3 py-1.5 text-sm"
            />
          </div>
          <button
            onClick={handleStatusSave}
            disabled={isPending}
            className="stone-button rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50"
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
      <div className="monster-card flex flex-col items-center gap-3 rounded-lg py-stack-loose text-center">
        <span className="material-symbols-outlined text-[40px] text-outline">forum</span>
        <p className="text-on-surface-variant">No feedback yet. Be the first to submit!</p>
      </div>
    );
  }

  return (
    <div className="space-y-gutter">
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
