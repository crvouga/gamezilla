import { expect, test } from 'bun:test';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { openPerformanceFixture } from '@pkgs/sync-engine-harness-ts/sync-performance-fixture';

test('the 1000-row 1 MiB benchmark preserves 100 pending writes across repeated merges', async () => {
  const fixture = await openPerformanceFixture();
  try {
    expect(
      new TextEncoder().encode(JSON.stringify(fixture.tables)).length
    ).toBe(1024 * 1024);
    const hash = fixture.hash();
    for (let i = 0; i < 3; i++) expect(await fixture.merge()).toBe('applied');
    expect(fixture.hash()).toBe(hash);
    expect(
      await fixture.db.query(
        sql<{ n: number }>`SELECT COUNT(*) AS n FROM notes`
      )
    ).toEqual([{ n: 1000 }]);
    expect(
      await fixture.db.query(
        sql<{
          n: number;
        }>`SELECT COUNT(*) AS n FROM notes WHERE body = 'pending'`
      )
    ).toEqual([{ n: 100 }]);
    expect(
      await fixture.db.query(
        sql<{
          n: number;
        }>`SELECT COUNT(*) AS n FROM sync_engine_mutations WHERE deleted_at IS NULL`
      )
    ).toEqual([{ n: 100 }]);
  } finally {
    await fixture.db.disconnect();
  }
});
