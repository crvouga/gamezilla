import { expect, test } from 'bun:test';
import { CONTENT_PAGE_SIZE } from '@libs/game-puzzle-shared-ts/content-query-scope';
import { seedLargeAttemptCatalogue } from './attempt-query-fixture';
import {
  contentQueryRunner,
  seedLargeContentCatalogue,
  withContentQueryFixture,
} from './content-query-fixture';

// regression: puzzle-query-pages-read-entire-catalogue
test.each([
  ['puzzleContentPublished', { gameId: 'pile' }],
  ['puzzleContentOwned', { gameId: 'pile' }],
  ['puzzleContentDraftCopies', { documentId: 'p0000' }],
  ['puzzleContentAttemptsOwned', { gameId: 'pile' }],
  ['puzzleContentPositionsOwned', { attemptId: 'attempt-p0000' }],
] as const)(
  '%s bounds database reads as well as the response',
  async (name, params) => {
    await withContentQueryFixture(async (fixture) => {
      await seedLargeContentCatalogue(fixture);
      await seedLargeAttemptCatalogue(fixture);
      const { run, reads } = contentQueryRunner(fixture);
      expect((await run(name, params)).status).toBe('ok');
      expect(reads.length).toBeGreaterThan(0);
      expect(Math.max(...reads)).toBeLessThanOrEqual(CONTENT_PAGE_SIZE);
    });
  }
);
