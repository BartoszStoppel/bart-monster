"use client";

import Image from "next/image";
import type { UserAlignment, AlignmentEntry } from "./compute-alignment";

interface AlignmentTableProps {
  alignments: UserAlignment[];
}

function Avatar({
  name,
  url,
  size = 20,
}: {
  name: string;
  url: string | null;
  size?: number;
}) {
  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full"
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-zinc-200 text-[10px] font-medium text-zinc-600 dark:bg-zinc-700 dark:text-zinc-300"
      style={{ width: size, height: size }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

const DIVIDER = "border-l-2 border-zinc-300 dark:border-zinc-600";

const GREEN_BG = [
  "bg-emerald-100/70 dark:bg-emerald-900/30",
  "bg-emerald-50/50 dark:bg-emerald-900/15",
  "bg-emerald-50/25 dark:bg-emerald-900/5",
];

const RED_BG = [
  "bg-red-100/70 dark:bg-red-900/30",
  "bg-red-50/50 dark:bg-red-900/15",
  "bg-red-50/25 dark:bg-red-900/5",
];

function AlignmentCell({
  entry,
  divider,
  bg,
}: {
  entry: AlignmentEntry | undefined;
  divider?: boolean;
  bg?: string;
}) {
  const classes = [
    divider ? DIVIDER : "",
    bg ?? "",
    "px-3 py-2",
  ].filter(Boolean).join(" ");

  if (!entry) {
    return (
      <td className={`${classes} text-center text-xs text-zinc-400 dark:text-zinc-500`}>
        —
      </td>
    );
  }
  return (
    <td className={classes}>
      <div className="flex items-center gap-1.5">
        <Avatar name={entry.displayName} url={entry.avatarUrl} />
        <span className="text-xs text-zinc-800 dark:text-zinc-200">
          {entry.displayName}
        </span>
      </div>
    </td>
  );
}

export function AlignmentTable({ alignments }: AlignmentTableProps) {
  if (alignments.length === 0) return null;

  return (
    <div>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-800/50">
              <th className="px-3 py-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                User
              </th>
              <th className={`${DIVIDER} px-3 py-2 text-center text-xs font-medium text-emerald-600 dark:text-emerald-400`} colSpan={3}>
                Taste Twins
              </th>
              <th className={`${DIVIDER} px-3 py-2 text-center text-xs font-medium text-red-500 dark:text-red-400`} colSpan={3}>
                Sworn Enemies
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {alignments.map((row) => (
              <tr key={row.userId}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={row.displayName}
                      url={row.avatarUrl}
                      size={24}
                    />
                    <span className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
                      {row.displayName}
                    </span>
                  </div>
                </td>
                <AlignmentCell entry={row.allies[0]} divider bg={GREEN_BG[0]} />
                <AlignmentCell entry={row.allies[1]} bg={GREEN_BG[1]} />
                <AlignmentCell entry={row.allies[2]} bg={GREEN_BG[2]} />
                <AlignmentCell entry={row.rivals[0]} divider bg={RED_BG[0]} />
                <AlignmentCell entry={row.rivals[1]} bg={RED_BG[1]} />
                <AlignmentCell entry={row.rivals[2]} bg={RED_BG[2]} />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-zinc-400 dark:text-zinc-500">
        Based on average score difference across shared games (min 3 shared).
        Lower avg diff = more similar taste.
      </p>
    </div>
  );
}
