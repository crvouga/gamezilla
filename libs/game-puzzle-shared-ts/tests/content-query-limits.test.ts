import { expect, test } from 'bun:test';
import { CONTENT_PAGE_SIZE } from '@libs/game-puzzle-shared-ts/content-query-scope';
import sql from '@pkgs/sql-root-shared-ts/sql';
import {
  contentQueryId,
  contentQueryRunner,
  seedLargeContentCatalogue,
  withContentQueryFixture,
} from './content-query-fixture';

test('catalogue pages and selected bodies remain bounded past the global snapshot budget', async () => {
  // regression: puzzle-content-global-snapshot-overflow
  await withContentQueryFixture(async (fixture) => {
    await seedLargeContentCatalogue(fixture);
    const { run, truncations } = contentQueryRunner(fixture);
    const first = await run('puzzleContentPublished', { gameId: 'pile' });
    expect(first.status).toBe('ok');
    if (first.status !== 'ok')
      throw new Error('The public page was not served');
    expect(first.tables['puzzle_content_documents']).toHaveLength(
      CONTENT_PAGE_SIZE
    );
    expect(first.tables['puzzle_content_revisions']).toHaveLength(
      CONTENT_PAGE_SIZE
    );
    expect(first.tables['puzzle_content_drafts']).toBeUndefined();
    const next = await run('puzzleContentPublished', {
      gameId: 'pile',
      afterId: contentQueryId(31),
    });
    if (next.status !== 'ok') throw new Error('The next page was not served');
    expect(next.tables['puzzle_content_documents']?.[0]?.['id']).toBe('p0032');
    const last = await run('puzzleContentPublished', {
      gameId: 'pile',
      afterId: contentQueryId(1_020),
    });
    if (last.status !== 'ok') throw new Error('The last page was not served');
    expect(last.tables['puzzle_content_documents']).toHaveLength(4);
    const own = await run('puzzleContentOwned', {
      gameId: 'pile',
      documentId: 'p0000',
    });
    if (own.status !== 'ok') throw new Error('The working copy was not served');
    expect(own.tables['puzzle_content_drafts']).toHaveLength(1);
    const copies = await run('puzzleContentDraftCopies', {
      documentId: 'p0000',
    });
    if (copies.status !== 'ok')
      throw new Error('The copies page was not served');
    expect(copies.tables['puzzle_content_drafts']).toHaveLength(
      CONTENT_PAGE_SIZE
    );
    expect(truncations).toEqual([]);
  });
});

test('a page propagates withdrawal and deletion while oversized edition batches are refused', async () => {
  await withContentQueryFixture(async (fixture) => {
    await seedLargeContentCatalogue(fixture);
    await fixture.db.run(
      sql`UPDATE puzzle_content_documents SET status = ${'withdrawn'} WHERE id = ${'p0003'}`
    );
    await fixture.db.run(
      sql`UPDATE puzzle_content_documents SET deleted_at = ${'2026-10-23T01:00:00.000Z'} WHERE id = ${'p0004'}`
    );
    const { run } = contentQueryRunner(fixture);
    const page = await run('puzzleContentPublished', { gameId: 'pile' });
    if (page.status !== 'ok') throw new Error('The public page was not served');
    expect(
      page.tables['puzzle_content_documents']?.find(
        (row) => row['id'] === 'p0003'
      )?.['status']
    ).toBe('withdrawn');
    expect(
      page.tables['puzzle_content_documents']?.find(
        (row) => row['id'] === 'p0004'
      )?.['deleted_at']
    ).toBe('2026-10-23T01:00:00.000Z');
    expect(
      await run('puzzleContentEditions', {
        ids: Array.from(
          { length: 33 },
          (_, index) => `${contentQueryId(index)}-edition`
        ),
      })
    ).toEqual({ status: 'denied' });
  });
});
