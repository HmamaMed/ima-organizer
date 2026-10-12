import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import ts from 'typescript';

// Compile the real utility with the project's TypeScript dependency; no extra runner required.
const source = await readFile(new URL('../src/modules/agios/agiosUtils.ts', import.meta.url), 'utf8');
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2023, module: ts.ModuleKind.ESNext },
});
const { amountInCents, creditDate, localDate, normalizeAmount, sortAgios, summarizeAgios, formatEntryAmount } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

test('interest input preserves cents and accepts dot or comma decimals', () => {
  assert.equal(normalizeAmount(' 125,55 '), '125.55');
  assert.equal(normalizeAmount('001.5'), '1.50');
  assert.equal(normalizeAmount('0.01'), '0.01');
  assert.equal(normalizeAmount('25'), '25.00');
  assert.equal(normalizeAmount('999999999999.99'), '999999999999.99');
  for (const value of ['', '0', '0.00', '-1', '1e3', '12.345', '1,234.56', '1000000000000', 'Infinity']) {
    assert.equal(normalizeAmount(value), null, value);
  }
  assert.equal(amountInCents('0.10') + amountInCents('0.20'), 30);
  assert.equal(amountInCents('75.40') + amountInCents('20.05'), 9545);
  assert.equal(amountInCents('-0.50'), -50);
  assert.equal(amountInCents('-200.25'), -20025);
});

test('withdrawals reduce the remaining balance while earned interest stays intact', () => {
  const entries = [
    { amount: '100.00', date: '2025-12-31' },
    { amount: '100.00', date: '2026-03-31' },
    { amount: '100.00', date: '2026-06-30' },
    { amount: '-200.00', date: '2026-07-01' },
  ];
  assert.deepEqual(summarizeAgios(entries, 2026), {
    balance: 10000, earned: 30000, withdrawn: 20000, yearEarned: 20000,
  });
  assert.deepEqual(summarizeAgios([], 2026), { balance: 0, earned: 0, withdrawn: 0, yearEarned: 0 });
  assert.deepEqual(summarizeAgios([{ amount: '0.30', date: '2026-01-01' }, { amount: '-0.50', date: '2026-01-02' }], 2026), {
    balance: -20, earned: 30, withdrawn: 50, yearEarned: 30,
  });
  assert.ok(formatEntryAmount('-200.00').startsWith('−'));
  assert.ok(formatEntryAmount('100.00').startsWith('+'));
  assert.ok(!formatEntryAmount('-200.00').startsWith('+'));
});

test('credit dates remain calendar days across timezones and year boundaries', () => {
  const originalTimezone = process.env.TZ;
  try {
    for (const timezone of ['Africa/Casablanca', 'America/Los_Angeles', 'Pacific/Auckland']) {
      process.env.TZ = timezone;
      for (const value of ['2025-12-31', '2026-01-01', '2024-02-29']) {
        assert.equal(localDate(creditDate(value)), value, `${timezone}: ${value}`);
      }
    }
    process.env.TZ = 'America/Los_Angeles';
    assert.equal(localDate(new Date('2026-01-01T00:30:00Z')), '2025-12-31');
  } finally {
    if (originalTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimezone;
  }
});

test('history sorts by credited date, then actual creation time, without mutating the feed', () => {
  const entries = [
    { id: 'older-credit', date: '2025-12-31', createdAt: '2026-10-01T12:00:00Z' },
    { id: 'first-same-day', date: '2026-01-01', createdAt: '2026-01-01T12:00:00Z' },
    { id: 'second-same-day', date: '2026-01-01', createdAt: '2026-01-01T12:00:00.100Z' },
  ];
  assert.deepEqual(sortAgios(entries).map((entry) => entry.id), ['second-same-day', 'first-same-day', 'older-credit']);
  assert.equal(entries[0].id, 'older-credit');
});
