"use client";

import Image from "next/image";
import Link from "next/link";
import type { UserAlignment, AlignmentEntry } from "./compute-alignment";

interface AlignmentTableProps {
  alignments: UserAlignment[];
}

function SplitName({ name, className }: { name: string; className?: string }) {
  const parts = name.split(" ");
  const first = parts[0];
  const last = parts.slice(1).join(" ");
  return (
    <span className={className}>
      {first}
      {last && <br />}
      {last}
    </span>
  );
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
      className="flex items-center justify-center rounded-full bg-surface-container-highest text-[10px] font-medium text-on-surface-variant"
      style={{ width: size, height: size }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

const DIVIDER = "border-l-2 border-outline-variant";

const GREEN_BG = [
  "bg-secondary-container/30",
  "bg-secondary-container/15",
  "bg-secondary-container/[0.05]",
];

const RED_BG = [
  "bg-error-container/30",
  "bg-error-container/15",
  "bg-error-container/[0.05]",
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
    "min-w-[6.5rem] px-3 py-2",
  ].filter(Boolean).join(" ");

  if (!entry) {
    return (
      <td className={`${classes} text-center text-xs text-on-surface-variant`}>
        —
      </td>
    );
  }
  return (
    <td className={classes}>
      <Link href={`/users/${entry.userId}`} className="flex flex-col items-center gap-1 transition-opacity hover:opacity-80">
        <Avatar name={entry.displayName} url={entry.avatarUrl} />
        <SplitName name={entry.displayName} className="text-center text-xs leading-tight text-on-surface" />
      </Link>
    </td>
  );
}

export function AlignmentTable({ alignments }: AlignmentTableProps) {
  if (alignments.length === 0) {
    return (
      <div className="monster-card flex flex-col items-center gap-3 rounded-lg py-stack-loose text-center">
        <span className="material-symbols-outlined text-[40px] text-outline">handshake</span>
        <p className="text-on-surface-variant">
          Not enough shared games to compute alignment yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="glass-card overflow-x-auto rounded-lg">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="px-3 py-2 text-center font-stat text-stat-label text-on-surface-variant">
                User
              </th>
              <th className={`${DIVIDER} px-3 py-2 text-center font-stat text-stat-label text-secondary`} colSpan={3}>
                Taste Twins
              </th>
              <th className={`${DIVIDER} px-3 py-2 text-center font-stat text-stat-label text-error`} colSpan={3}>
                Sworn Enemies
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant">
            {[...alignments].sort((a, b) => a.displayName.localeCompare(b.displayName)).map((row) => (
              <tr key={row.userId}>
                <td className="min-w-[7.5rem] px-3 py-2">
                  <Link href={`/users/${row.userId}`} className="flex flex-col items-center gap-1 transition-opacity hover:opacity-80">
                    <Avatar
                      name={row.displayName}
                      url={row.avatarUrl}
                      size={24}
                    />
                    <SplitName name={row.displayName} className="text-center text-sm font-medium leading-tight text-on-surface" />
                  </Link>
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
      <p className="mt-2 text-[11px] text-on-surface-variant">
        Based on average score difference across shared games (min 3 shared).
        Lower avg diff = more similar taste.
      </p>
    </div>
  );
}
