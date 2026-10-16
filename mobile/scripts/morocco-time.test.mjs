import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
const source = await readFile(new URL('../src/shared/utils/moroccoTime.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext } });
const { moroccoTimeZone, moroccoDateKey, moroccoHour, addCalendarDays, scheduledNoteInstant } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
test('Morocco uses GMT after the September 2026 change, despite stale ICU data', () => {
  for (const deviceZone of ['America/Los_Angeles', 'Asia/Tokyo', 'Africa/Casablanca', 'UTC']) {
    process.env.TZ = deviceZone;
    const date = new Date('2026-10-16T23:30:00Z');
    assert.equal(moroccoDateKey(date), '2026-10-16');
    assert.equal(moroccoHour(date), 23);
    assert.equal(moroccoTimeZone(date), 'UTC');
    assert.equal(scheduledNoteInstant('2026-10-17', 19), '2026-10-17T19:00:00.000Z');
  }
});
test('historical instants keep Moroccan seasonal time while new schedules use GMT', () => {
  assert.equal(moroccoTimeZone(new Date('2026-09-20T00:59:59Z')), 'Africa/Casablanca');
  assert.equal(moroccoTimeZone(new Date('2026-09-20T01:00:00Z')), 'UTC');
  assert.equal(moroccoHour(new Date('2026-08-01T12:00:00Z')), 13);
  assert.equal(moroccoHour(new Date('2026-03-01T12:00:00Z')), 12);
});
test('schedule date chips cross months, years and leap days without device timezone drift', () => {
  assert.equal(addCalendarDays('2026-12-31', 1), '2027-01-01');
  assert.equal(addCalendarDays('2028-02-28', 1), '2028-02-29');
  assert.equal(addCalendarDays('2027-02-28', 1), '2027-03-01');
  assert.equal(moroccoDateKey(new Date(scheduledNoteInstant('2027-01-01', 0))), '2027-01-01');
});
