export interface HistoryObservation {
  snapshotAt: string;
  score: number | null;
  imported?: boolean;
}
export interface HistoryPoint {
  date: number;
  score: number;
  iso: string;
  change: number | null;
  carried?: boolean;
}
const DAY = 86400000;
export function historySegments(
  observations: HistoryObservation[],
  today: string,
): HistoryPoint[][] {
  const daily = new Map<string, HistoryObservation>();
  for (const row of observations) daily.set(row.snapshotAt.slice(0, 10), row);
  const rows = [...daily].sort(([a], [b]) => a.localeCompare(b));
  const segments: HistoryPoint[][] = [];
  let segment: HistoryPoint[] = [];
  let previous: HistoryObservation | undefined;
  for (const [day, row] of rows) {
    const date = Date.parse(day + "T12:00:00Z");
    const prevDate = previous
      ? Date.parse(previous.snapshotAt.slice(0, 10) + "T12:00:00Z")
      : 0;
    if (
      row.score === null &&
      segment.length &&
      previous &&
      !previous.imported &&
      date - prevDate > DAY
    )
      segment.push({
        ...segment[segment.length - 1],
        date: date - DAY,
        iso: new Date(date - DAY).toISOString().slice(0, 10),
        change: null,
        carried: true,
      });
    if (row.score === null || (previous?.imported && date - prevDate > DAY)) {
      if (segment.length) segments.push(segment);
      segment = [];
    }
    if (row.score !== null)
      segment.push({
        date,
        score: row.score,
        iso: day,
        change: segment.length
          ? Math.round((row.score - segment[segment.length - 1].score) * 10) /
            10
          : null,
      });
    previous = row;
  }
  if (segment.length) {
    const end = Date.parse(today + "T12:00:00Z");
    const last = segment[segment.length - 1];
    if (previous && !previous.imported && end > last.date)
      segment.push({
        ...last,
        date: end,
        iso: today,
        change: null,
        carried: true,
      });
    segments.push(segment);
  }
  return segments;
}
export function localDay() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Indiana/Indianapolis",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}
