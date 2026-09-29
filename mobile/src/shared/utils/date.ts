/** True if the two ISO instants fall on the same calendar day, in local time. */
export function isSameLocalDay(isoA: string, isoB: string): boolean {
  const a = new Date(isoA);
  const b = new Date(isoB);
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export interface WeekdayPip {
  label: string;
  date: Date;
  isToday: boolean;
  hasLog: boolean;
}

/**
 * Monday-to-Sunday strip for the current week, each day marked whether any
 * of the given completion instants fell on it.
 */
export function buildWeekdayStrip(completedAtDates: string[]): WeekdayPip[] {
  const today = new Date();
  // getDay(): 0=Sun..6=Sat. Shift so Monday is the start of the row.
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);

  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const dayIso = day.toISOString();
    return {
      label: day.toLocaleDateString(undefined, { weekday: 'narrow' }),
      date: day,
      isToday: isSameLocalDay(dayIso, today.toISOString()),
      hasLog: completedAtDates.some((iso) => isSameLocalDay(iso, dayIso)),
    };
  });
}

/** Consecutive days (ending today or yesterday) that have at least one completion. */
export function computeStreak(completedAtDates: string[]): number {
  const cursor = new Date();

  // A streak shouldn't collapse to zero just because today's session hasn't
  // happened yet — only a fully missed day ends it. So when today is still
  // empty, start counting back from yesterday.
  if (!completedAtDates.some((iso) => isSameLocalDay(iso, cursor.toISOString()))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  let streak = 0;
  for (;;) {
    if (!completedAtDates.some((iso) => isSameLocalDay(iso, cursor.toISOString()))) {
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/**
 * YYYY-MM-DD in *local* time. `toISOString().slice(0, 10)` would give the UTC
 * day, which rolls over at the wrong moment for anyone not on UTC — an evening
 * workout would be filed under tomorrow.
 */
export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export interface HeatmapCell {
  date: Date;
  key: string;
  count: number;
  isToday: boolean;
}

/**
 * Calendar grid of the last {@code weeks} weeks, Monday-aligned columns, each
 * cell carrying how many completions landed on it.
 */
export function buildHeatmap(completedAtDates: string[], weeks = 12): HeatmapCell[] {
  const counts = new Map<string, number>();
  for (const iso of completedAtDates) {
    const key = localDateKey(new Date(iso));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const today = new Date();
  const todayKey = localDateKey(today);

  // Walk back to the Monday that starts the window.
  const start = new Date(today);
  start.setDate(today.getDate() - (weeks * 7 - 1));
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));

  const cells: HeatmapCell[] = [];
  const cursor = new Date(start);
  while (cursor <= today) {
    const key = localDateKey(cursor);
    cells.push({
      date: new Date(cursor),
      key,
      count: counts.get(key) ?? 0,
      isToday: key === todayKey,
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return cells;
}
