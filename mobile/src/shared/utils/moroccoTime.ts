/** Morocco returned permanently to GMT on 2026-09-20 at 02:00 old local time.
 * Explicit UTC after the change avoids stale browser/Android ICU data reporting GMT+1.
 * Source: IANA tz africa, Africa/Casablanca; Decree 2.26.530.
 */
export const MOROCCO_TIME_LABEL = 'Morocco · GMT';
export const MOROCCO_TIME_ZONE = 'Africa/Casablanca';
const GMT_START = Date.parse('2026-09-20T01:00:00Z');
export function moroccoTimeZone(date = new Date()): string {
  return date.getTime() >= GMT_START ? 'UTC' : MOROCCO_TIME_ZONE;
}
export function moroccoFormat(date: Date, options: Intl.DateTimeFormatOptions, locale?: string): string {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: moroccoTimeZone(date) }).format(date);
}
export function moroccoDateKey(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: moroccoTimeZone(date), year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const part = (name: string) => parts.find(p => p.type === name)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export function moroccoHour(date = new Date()): number {
  return Number(new Intl.DateTimeFormat('en-GB', {
    timeZone: moroccoTimeZone(date), hour: '2-digit', hourCycle: 'h23',
  }).format(date));
}
/** Calendar-only arithmetic, independent of the phone's timezone. */
export function addCalendarDays(date: string, days: number): string {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
/** Note scheduling uses Morocco's current GMT policy, never the device timezone. */
export function scheduledNoteInstant(date: string, hour: number): string {
  return new Date(`${date}T${String(hour).padStart(2, '0')}:00:00.000Z`).toISOString();
}
