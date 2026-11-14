import { expect, test } from 'bun:test';
import {
  byNewestPublication,
  CONTENT_PAGE_SIZE,
  PUBLISHED_PAGE_START,
  type PublishedPageCursor,
} from '@libs/game-puzzle-shared-ts/content-query-scope';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  type ContentFixture,
  createContentFixture,
  publishContentFixture,
} from './content-fixture';
import {
  contentQueryId,
  contentQueryPublishedAt,
  contentQueryRunner,
  seedLargeContentCatalogue,
  withContentQueryFixture,
} from './content-query-fixture';

type Row = { readonly id: string; readonly published_at: string | null };

async function browsePage(
  run: ReturnType<typeof contentQueryRunner>['run'],
  cursor: PublishedPageCursor
): Promise<readonly Row[]> {
  const page = await run('puzzleContentPublished', {
    gameId: 'pile',
    ...cursor,
  });
  if (page.status !== 'ok') throw new Error('The Browse page was not served');
  return (page.tables['puzzle_content_publications'] ?? []).map((row) => ({
    id: String(row['id']),
    published_at: String(row['published_at']),
  }));
}

/** The cursor the client sends for the page after `rows`. */
function after(rows: readonly Row[]): PublishedPageCursor {
  const last = rows.at(-1);
  if (last?.published_at == null) throw new Error('A page ends on a row');
  return { beforeAt: last.published_at, beforeId: last.id };
}

test('Browse lists the newest publication first, breaking a tie by id', async () => {
  // regression: numberlink-discovery-pages-through-stale-packs
  await withContentQueryFixture(async (fixture) => {
    await seedLargeContentCatalogue(fixture);
    const { run } = contentQueryRunner(fixture);
    const first = await browsePage(run, PUBLISHED_PAGE_START);
    expect(first.map((row) => row.id).slice(0, 4)).toEqual([
      contentQueryId(1_024),
      contentQueryId(1_023),
      contentQueryId(1_022),
      contentQueryId(1_021),
    ]);
    expect(first[1]?.published_at).toBe(first[2]?.published_at ?? '');
    expect(first).toEqual(first.toSorted(byNewestPublication));
  });
});

test('Browse pages cover every publication once, even when one is published mid-walk', async () => {
  // regression: numberlink-discovery-pages-through-stale-packs
  await withContentQueryFixture(async (fixture) => {
    await seedLargeContentCatalogue(fixture);
    const { run } = contentQueryRunner(fixture);
    const seen: Row[] = [];
    let cursor: PublishedPageCursor = PUBLISHED_PAGE_START;
    for (let pages = 0; ; pages++) {
      const rows = await browsePage(run, cursor);
      expect(rows.length).toBeLessThanOrEqual(CONTENT_PAGE_SIZE);
      seen.push(...rows);
      if (rows.length < CONTENT_PAGE_SIZE) break;
      cursor = after(rows);
      if (pages === 0)
        await fixture.db.run(
          sql`UPDATE puzzle_content_publications SET published_at = ${contentQueryPublishedAt(5_000)} WHERE id = ${contentQueryId(0)}`
        );
    }
    const ids = seen.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(1_024);
    expect(ids).not.toContain(contentQueryId(0));
    expect(seen).toEqual(seen.toSorted(byNewestPublication));
    const fresh = await browsePage(run, PUBLISHED_PAGE_START);
    expect(fresh[0]?.id).toBe(contentQueryId(0));
  });
});

test('publishing stamps its own time, so the latest publication heads Browse', async () => {
  // regression: numberlink-discovery-pages-through-stale-packs
  await withContentQueryFixture(async (fixture) => {
    const at = (ms: number): ContentFixture => ({
      ...fixture,
      env: { ...fixture.env, now: () => new Date(ms) },
    });
    for (const [id, ms] of [
      ['zeta', 1_000],
      ['alpha', 2_000],
    ] as const) {
      await createContentFixture(at(ms), { id, title: id });
      await publishContentFixture(at(ms), id);
    }
    const { run } = contentQueryRunner(fixture);
    expect(await browsePage(run, PUBLISHED_PAGE_START)).toEqual([
      { id: 'alpha', published_at: new Date(2_000).toISOString() },
      { id: 'zeta', published_at: new Date(1_000).toISOString() },
    ]);
  });
});
