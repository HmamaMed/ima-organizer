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
  let streak = 0;
  const cursor = new Date();
  for (;;) {
    const cursorIso = cursor.toISOString();
    if (!completedAtDates.some((iso) => isSameLocalDay(iso, cursorIso))) {
      break;
    }
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
