import { expect, test } from 'bun:test';
import { CONTENT_QUERIES } from '@libs/game-puzzle-shared-ts/content-query-registry';
import { CONTENT_PAGE_SIZE } from '@libs/game-puzzle-shared-ts/content-query-scope';
import { seedLargeAttemptCatalogue } from './attempt-query-fixture';
import {
  contentQueryRunner,
  seedLargeContentCatalogue,
  withContentQueryFixture,
} from './content-query-fixture';

test.each([
  ['puzzleContentPublished', { gameId: 'pile' }],
  ['puzzleContentOwned', { gameId: 'pile' }],
  ['puzzleContentDraftCopies', { documentId: 'p0000' }],
  ['puzzleContentAttemptsOwned', { gameId: 'pile' }],
  ['puzzleContentPositionsOwned', { attemptId: 'attempt-p0000' }],
] as const)(
  '%s materializes no more than its declared budget plus one overflow row',
  async (name, params) => {
    await withContentQueryFixture(async (fixture) => {
      await seedLargeContentCatalogue(fixture);
      await seedLargeAttemptCatalogue(fixture);
      const { run, reads } = contentQueryRunner(fixture);
      expect((await run(name, params)).status).toBe('ok');
      expect(reads.length).toBeGreaterThan(0);
      const budget = CONTENT_QUERIES.find(
        (query) => query.name === name
      )?.limit;
      if (budget === undefined)
        throw new Error('A page must declare its row budget');
      expect(budget).toBeLessThanOrEqual(CONTENT_PAGE_SIZE * 5);
      expect(Math.max(...reads)).toBeLessThanOrEqual(budget + 1);
    });
  }
);
