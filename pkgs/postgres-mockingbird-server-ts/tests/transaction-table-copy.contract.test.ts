import { expect, test } from 'bun:test';
import { openMockingbirdDatabase } from '@pkgs/postgres-mockingbird-server-ts/start';

const SMALL_ROWS = 200;
const LARGE_ROWS = 20_000;
const SAMPLES = 25;

function tableOf(rows: number) {
  const database = openMockingbirdDatabase(null);
  database.exec('CREATE TABLE rows (id text PRIMARY KEY, n int4, body text)');
  const insert = database.prepare('INSERT INTO rows VALUES ($1, $2, $3)');
  database.transaction(() => {
    for (let i = 0; i < rows; i++) insert.run(`row-${i}`, i, 'x'.repeat(64));
  });
  return database;
}

/** Median wall time of one single-row write inside its own transaction. */
function medianWriteMs(rows: number): number {
  const database = tableOf(rows);
  const update = database.prepare('UPDATE rows SET n = n + 1 WHERE id = $1');
  try {
    const samples: number[] = [];
    for (let i = 0; i < SAMPLES; i++) {
      const started = performance.now();
      database.transaction(() => update.run(`row-${i}`));
      samples.push(performance.now() - started);
    }
    samples.sort((a, b) => a - b);
    return samples[Math.floor(SAMPLES / 2)] ?? 0;
  } finally {
    database.close();
  }
}

// regression: mockingbird-postgres-transaction-copies-table
test('a write inside a transaction does not copy the whole table', () => {
  const small = medianWriteMs(SMALL_ROWS);
  const large = medianWriteMs(LARGE_ROWS);
  // The engine copied a table on its first write in every transaction, so a
  // one-row update over 100 times as many rows cost roughly 100 times as much
  // (3.4 ms at 1k rows, 108 ms at 50k). Now it records only the rows the
  // transaction wrote; the bound leaves an order of magnitude for noise.
  expect(large).toBeLessThan(Math.max(small, 0.05) * 10);
});
