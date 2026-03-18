"use client";

import { useMemo } from "react";

interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * Lightweight markdown renderer for chat messages.
 * Supports: **bold**, *italic*, `code`, headers, lists, numbered lists, tables, and paragraphs.
 */
export function Markdown({ content, className = "" }: MarkdownProps) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className={`space-y-2 ${className}`}>
      {blocks.map((block, i) => (
        <Block key={i} block={block} />
      ))}
    </div>
  );
}

type BlockType =
  | { type: "heading"; level: number; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "paragraph"; text: string };

function isTableRow(line: string): boolean {
  return line.trimStart().startsWith("|") && line.trimEnd().endsWith("|");
}

function isSeparatorRow(line: string): boolean {
  return /^\|[\s:?-]+(\|[\s:?-]+)+\|$/.test(line.trim());
}

function parseTableCells(line: string): string[] {
  return line
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());
}

function parseBlocks(content: string): BlockType[] {
  const lines = content.split("\n");
  const blocks: BlockType[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.trim() === "") {
      i++;
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2] });
      i++;
      continue;
    }

    if (isTableRow(line) && i + 1 < lines.length && isSeparatorRow(lines[i + 1])) {
      const headers = parseTableCells(line);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && isTableRow(lines[i]) && !isSeparatorRow(lines[i])) {
        rows.push(parseTableCells(lines[i]));
        i++;
      }
      blocks.push({ type: "table", headers, rows });
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (ulMatch || olMatch) {
      const ordered = !!olMatch;
      const items: string[] = [];
      while (i < lines.length) {
        const l = lines[i];
        const m = ordered ? l.match(/^\d+\.\s+(.+)$/) : l.match(/^[-*]\s+(.+)$/);
        if (!m) break;
        items.push(m[1]);
        i++;
      }
      blocks.push({ type: "list", ordered, items });
      continue;
    }

    blocks.push({ type: "paragraph", text: line });
    i++;
  }

  return blocks;
}

function Block({ block }: { block: BlockType }) {
  switch (block.type) {
    case "heading": {
      const cls =
        block.level === 1
          ? "text-base font-bold"
          : block.level === 2
            ? "text-sm font-semibold"
            : "text-sm font-medium";
      return <p className={cls}><InlineText text={block.text} /></p>;
    }
    case "list":
      if (block.ordered) {
        return (
          <ol className="list-decimal space-y-0.5 pl-5">
            {block.items.map((item, i) => (
              <li key={i}><InlineText text={item} /></li>
            ))}
          </ol>
        );
      }
      return (
        <ul className="list-disc space-y-0.5 pl-5">
          {block.items.map((item, i) => (
            <li key={i}><InlineText text={item} /></li>
          ))}
        </ul>
      );
    case "table":
      return (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-current/10">
                {block.headers.map((h, i) => (
                  <th key={i} className="px-2 py-1 text-left font-semibold">
                    <InlineText text={h} />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, ri) => (
                <tr key={ri} className="border-b border-current/5">
                  {row.map((cell, ci) => (
                    <td key={ci} className="px-2 py-1">
                      <InlineText text={cell} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "paragraph":
      return <p><InlineText text={block.text} /></p>;
  }
}

function InlineText({ text }: { text: string }) {
  const parts = useMemo(() => parseInline(text), [text]);
  return <>{parts.map((p, i) => <InlinePart key={i} part={p} />)}</>;
}

type InlinePart =
  | { type: "text"; text: string }
  | { type: "bold"; text: string }
  | { type: "italic"; text: string }
  | { type: "code"; text: string };

function parseInline(text: string): InlinePart[] {
  const parts: InlinePart[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", text: text.slice(lastIndex, match.index) });
    }
    if (match[2]) {
      parts.push({ type: "bold", text: match[2] });
    } else if (match[3]) {
      parts.push({ type: "italic", text: match[3] });
    } else if (match[4]) {
      parts.push({ type: "code", text: match[4] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", text: text.slice(lastIndex) });
  }

  return parts;
}

function InlinePart({ part }: { part: InlinePart }) {
  switch (part.type) {
    case "bold":
      return <strong className="font-semibold">{part.text}</strong>;
    case "italic":
      return <em>{part.text}</em>;
    case "code":
      return <code className="rounded bg-black/10 px-1 py-0.5 text-[0.85em] dark:bg-white/10">{part.text}</code>;
    case "text":
      return <>{part.text}</>;
  }
}
