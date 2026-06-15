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
  const router = useRouter();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setSaved(false);

    const supabase = createClient();
    await supabase
      .from("profiles")
      .update({
        display_name: name.trim(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    setSaving(false);
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="flex items-end gap-3">
      <div className="flex-1">
        <label
          htmlFor="display-name"
          className="mb-1 block font-stat text-xs uppercase tracking-wide text-on-surface-variant"
        >
          Display Name
        </label>
        <input
          id="display-name"
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          className="carved-input w-full rounded-md px-3 py-2 text-sm focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={saving || name.trim() === currentName}
        className="stone-button rounded-md px-4 py-2 font-stat text-stat-label transition-colors disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Saving..." : saved ? "Saved!" : "Save"}
      </button>
    </form>
  );
}
