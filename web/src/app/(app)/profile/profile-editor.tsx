"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

interface ProfileEditorProps {
  currentName: string;
  userId: string;
}

export function ProfileEditor({ currentName, userId }: ProfileEditorProps) {
  const [name, setName] = useState(currentName);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);
    setSaved(false);

    const supabase = createClient();
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSaved(true);
    router.refresh();
  }

  return (
    <>
      <form onSubmit={handleSave} className="flex items-end gap-3">
        <div className="flex-1">
          <label
            htmlFor="display-name"
            className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400"
          >
            Display Name
          </label>
          <input
            id="display-name"
            type="text"
            maxLength={150}
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setSaved(false);
            }}
            className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100"
          />
        </div>
        <button
          type="submit"
          disabled={saving || name.trim() === currentName}
          className="rounded-md bg-gradient-to-r from-cyan-500 to-cyan-600 px-4 py-2 text-sm font-medium text-white transition-colors shadow-lg shadow-cyan-500/25 hover:shadow-cyan-500/40 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? "Saving..." : saved ? "Saved!" : "Save"}
        </button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600 dark:text-red-300">
          {error}
        </p>
      )}
    </>
  );
}
