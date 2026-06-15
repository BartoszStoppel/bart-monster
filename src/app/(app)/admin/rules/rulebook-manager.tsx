"use client";

import { useState } from "react";

import { saveGameRules, deleteGameRules } from "./actions";
import type { GameRulesModule, RulesModuleType } from "@/types/database";

interface CollectionGame {
  bgg_id: number;
  name: string;
}

type ExistingModule = Omit<GameRulesModule, "content_md" | "created_by">;

interface RulebookManagerProps {
  games: CollectionGame[];
  existing: ExistingModule[];
}

const inputClass =
  "carved-input w-full rounded-md px-3 py-2 text-sm";

export function RulebookManager({ games, existing }: RulebookManagerProps) {
  const [bggId, setBggId] = useState<number | "">("");
  const [moduleName, setModuleName] = useState("Base Game");
  const [moduleType, setModuleType] = useState<RulesModuleType>("base");
  const [markdown, setMarkdown] = useState("");
  const [tokenEstimate, setTokenEstimate] = useState<number | null>(null);
  const [source, setSource] = useState("");
  const [converting, setConverting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function handleConvert(file: File) {
    setConverting(true);
    setError(null);
    setNotice(null);
    try {
      const body = new FormData();
      body.set("file", file);
      const res = await fetch("/api/rules/convert", { method: "POST", body });
      if (!res.ok) throw new Error((await res.text()) || `HTTP ${res.status}`);
      const data = (await res.json()) as {
        markdown: string;
        tokenEstimate: number;
        truncated: boolean;
      };
      setMarkdown(data.markdown);
      setTokenEstimate(data.tokenEstimate);
      setSource(file.name);
      if (data.truncated) {
        setNotice(
          "Conversion hit the output limit and may be truncated — review the end, and consider splitting this rulebook into smaller modules.",
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Conversion failed");
    } finally {
      setConverting(false);
    }
  }

  async function handleSave() {
    if (bggId === "" || !moduleName.trim() || !markdown.trim()) {
      setError("Pick a game, name the module, and provide rulebook content.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await saveGameRules({
        bggId: Number(bggId),
        moduleName: moduleName.trim(),
        moduleType,
        contentMd: markdown,
        tokenEstimate: tokenEstimate ?? Math.ceil(markdown.length / 4),
        source: source.trim() || null,
      });
      setNotice("Saved.");
      setMarkdown("");
      setTokenEstimate(null);
      setSource("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const gameName = (id: number) => games.find((g) => g.bgg_id === id)?.name ?? `#${id}`;

  return (
    <div className="flex flex-col gap-stack-loose">
      <section className="glass-card flex flex-col gap-gutter rounded-lg p-card-padding sm:p-6">
        <h2 className="flex items-center gap-2 font-display text-headline-lg-mobile text-on-surface">
          <span className="material-symbols-outlined stat-icon text-[22px]">post_add</span>
          Add / update a rulebook module
        </h2>

        <div className="grid gap-gutter sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block font-stat text-stat-label text-on-surface-variant">Game</span>
            <select
              className={inputClass}
              value={bggId}
              onChange={(e) => setBggId(e.target.value ? Number(e.target.value) : "")}
            >
              <option value="">Select a game…</option>
              {games.map((g) => (
                <option key={g.bgg_id} value={g.bgg_id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-stat text-stat-label text-on-surface-variant">Module type</span>
            <select
              className={inputClass}
              value={moduleType}
              onChange={(e) => {
                const next = e.target.value as RulesModuleType;
                setModuleType(next);
                if (next === "base" && !moduleName.trim()) setModuleName("Base Game");
              }}
            >
              <option value="base">Base game</option>
              <option value="expansion">Expansion</option>
            </select>
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-stat text-stat-label text-on-surface-variant">Module name</span>
            <input
              className={inputClass}
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder="e.g. Base Game or Leaders & Wonders"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block font-stat text-stat-label text-on-surface-variant">
              Rulebook PDF (auto-converts to Markdown)
            </span>
            <input
              type="file"
              accept="application/pdf"
              className={inputClass}
              disabled={converting}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleConvert(file);
              }}
            />
          </label>
        </div>

        {converting && (
          <p className="flex items-center gap-2 font-stat text-stat-label text-primary">
            <span className="material-symbols-outlined text-[16px] animate-pulse">hourglass_top</span>
            Converting PDF to Markdown… this can take a minute for long rulebooks.
          </p>
        )}

        <label className="block text-sm">
          <span className="mb-1 flex items-center justify-between font-stat text-stat-label text-on-surface-variant">
            <span>Markdown (review and edit before saving)</span>
            {tokenEstimate !== null && (
              <span className="font-stat text-on-surface">~{tokenEstimate.toLocaleString()} tokens</span>
            )}
          </span>
          <textarea
            className={`${inputClass} h-72 font-mono`}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Upload a PDF above, or paste cleaned Markdown here."
          />
        </label>

        {error && (
          <p className="flex items-center gap-2 font-stat text-stat-label text-error">
            <span className="material-symbols-outlined text-[16px]">error</span>
            {error}
          </p>
        )}
        {notice && (
          <p className="flex items-center gap-2 font-stat text-stat-label text-secondary">
            <span className="material-symbols-outlined text-[16px]">check_circle</span>
            {notice}
          </p>
        )}

        <button
          onClick={handleSave}
          disabled={saving || converting}
          className="stone-button flex items-center gap-2 self-start rounded-md px-5 py-2.5 font-stat text-stat-label disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">save</span>
          {saving ? "Saving…" : "Save module"}
        </button>
      </section>

      <section className="flex flex-col gap-gutter">
        <h2 className="flex items-center gap-2 font-display text-headline-lg-mobile text-on-surface">
          <span className="material-symbols-outlined stat-icon text-[22px]">library_books</span>
          Loaded rulebooks
        </h2>
        {existing.length === 0 ? (
          <div className="monster-card flex flex-col items-center gap-3 rounded-lg py-stack-loose text-center">
            <span className="material-symbols-outlined text-[40px] text-outline">menu_book</span>
            <p className="text-on-surface-variant">No rulebooks loaded yet.</p>
          </div>
        ) : (
          existing.map((m) => (
            <ExistingRow key={m.id} module={m} gameName={gameName(m.bgg_id)} />
          ))
        )}
      </section>
    </div>
  );
}

function ExistingRow({
  module,
  gameName,
}: {
  module: ExistingModule;
  gameName: string;
}) {
  const [deleting, setDeleting] = useState(false);

  return (
    <div className="glass-card flex items-center justify-between gap-4 rounded-lg p-card-padding">
      <div className="flex min-w-0 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-display text-headline-lg-mobile text-on-surface">{gameName}</span>
          <span className="rune-chip shrink-0 rounded-full px-2 py-0.5 font-stat text-caption text-on-surface-variant">
            {module.module_name}
          </span>
          {module.module_type === "expansion" && (
            <span className="rune-chip active shrink-0 rounded-full px-2 py-0.5 font-stat text-caption">
              expansion
            </span>
          )}
        </div>
        <span className="truncate font-stat text-stat-label text-on-surface-variant">
          {module.token_estimate ? `~${module.token_estimate.toLocaleString()} tokens` : "size n/a"}
          {module.source ? ` · ${module.source}` : ""}
        </span>
      </div>
      <button
        onClick={async () => {
          setDeleting(true);
          await deleteGameRules(module.id);
          setDeleting(false);
        }}
        disabled={deleting}
        className="flex shrink-0 items-center gap-2 rounded-md border border-error px-4 py-2 font-stat text-stat-label text-error transition-colors hover:bg-error-container/15 disabled:opacity-50"
      >
        <span className="material-symbols-outlined text-[16px]">delete</span>
        {deleting ? "…" : "Delete"}
      </button>
    </div>
  );
}
