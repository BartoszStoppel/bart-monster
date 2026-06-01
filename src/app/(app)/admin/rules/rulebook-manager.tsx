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
  "w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 dark:border-white/10 dark:bg-white/5 dark:text-zinc-50";

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
    <div className="space-y-8">
      <section className="space-y-4 rounded-lg border border-zinc-200 bg-white p-5 dark:border-white/[0.06] dark:bg-white/5">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Add / update a rulebook module
        </h2>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Game</span>
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
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Module type</span>
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
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">Module name</span>
            <input
              className={inputClass}
              value={moduleName}
              onChange={(e) => setModuleName(e.target.value)}
              placeholder="e.g. Base Game or Leaders & Wonders"
            />
          </label>

          <label className="text-sm">
            <span className="mb-1 block text-zinc-600 dark:text-zinc-400">
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
          <p className="text-sm text-blue-600 dark:text-blue-400">
            Converting PDF to Markdown… this can take a minute for long rulebooks.
          </p>
        )}

        <label className="block text-sm">
          <span className="mb-1 flex items-center justify-between text-zinc-600 dark:text-zinc-400">
            <span>Markdown (review and edit before saving)</span>
            {tokenEstimate !== null && <span>~{tokenEstimate.toLocaleString()} tokens</span>}
          </span>
          <textarea
            className={`${inputClass} h-72 font-mono`}
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder="Upload a PDF above, or paste cleaned Markdown here."
          />
        </label>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        {notice && <p className="text-sm text-green-600 dark:text-green-400">{notice}</p>}

        <button
          onClick={handleSave}
          disabled={saving || converting}
          className="rounded-md border border-blue-200 px-4 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-50 disabled:opacity-50 dark:border-blue-800 dark:text-blue-400 dark:hover:bg-blue-900/20"
        >
          {saving ? "Saving…" : "Save module"}
        </button>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Loaded rulebooks
        </h2>
        {existing.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">No rulebooks loaded yet.</p>
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
    <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white p-4 dark:border-white/[0.06] dark:bg-white/5">
      <div>
        <div className="flex items-center gap-2">
          <span className="font-medium text-zinc-900 dark:text-zinc-50">{gameName}</span>
          <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
            {module.module_name}
          </span>
          {module.module_type === "expansion" && (
            <span className="rounded-full bg-purple-100 px-2 py-0.5 text-xs font-medium text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
              expansion
            </span>
          )}
        </div>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
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
        className="rounded-md border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
      >
        {deleting ? "…" : "Delete"}
      </button>
    </div>
  );
}
