import sql from '@pkgs/sql-shared/sql';
import type { Sql } from '@pkgs/sql-shared/sql';

const before = process.memoryUsage();
process.stdout.write(
  `before: ${before.heapUsed} bytes / ${before.heapTotal} bytes\n`
);
const start = process.hrtime();

const queries: Sql[] = [];

for (let i = 0; i < 1_000_000; i++) {
  const rawQuery = sql<void>`there`;
  const subQuery = sql<void>`something ${'goes'} here and ${rawQuery}`;
  const query = sql<void>`this is ${'the'} query: ${i}, ${subQuery}`;
  queries.push(query);

  // Compute properties for perf testing.
  query.sql;
  query.text;
  query.values;
}

const end = process.hrtime(start);
const after = process.memoryUsage();
process.stdout.write(
  `after: ${after.heapUsed} bytes / ${after.heapTotal} bytes\n`
);
process.stdout.write(`difference: ${after.heapUsed - before.heapUsed} bytes\n`);
process.stdout.write(`time: ${end[0]}s ${~~(end[1] / 1000000)}ms\n`);
