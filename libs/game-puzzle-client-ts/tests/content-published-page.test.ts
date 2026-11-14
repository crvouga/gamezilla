import { expect, test } from 'bun:test';
import { createPublishedPage } from '@libs/game-puzzle-client-ts/use-content-pages';
import {
  CONTENT_PAGE_SIZE,
  PUBLISHED_PAGE_START,
} from '@libs/game-puzzle-shared-ts/content-query-scope';
import type { ContentDocument } from '@libs/game-puzzle-shared-ts/content-types';
import { createRoot } from 'solid-js';

const STAMP = Date.parse('2026-11-01T00:00:00.000Z');

function publication(index: number): ContentDocument {
  return {
    id: `pack-${String(index).padStart(3, '0')}`,
    owner_id: 'monitor',
    game_id: 'pile',
    kind: 'pack',
    working_draft_id: null,
    published_revision_id: `edition-${index}`,
    publication_count: 1,
    status: 'published',
    published_at: new Date(STAMP + index * 60_000).toISOString(),
    deleted_at: null,
  };
}

test('Browse asks for its next page after the oldest row of the newest-first window', () => {
  // regression: numberlink-discovery-pages-through-stale-packs
  createRoot((dispose) => {
    const rows = Array.from({ length: CONTENT_PAGE_SIZE + 8 }, (_, index) =>
      publication(index)
    ).toReversed();
    const page = createPublishedPage(() => rows);
    expect(page.cursors()).toEqual([PUBLISHED_PAGE_START]);
    expect(page.hasMore()).toBe(true);
    page.more();
    page.more();
    const edge = publication(8);
    expect(page.cursors()).toEqual([
      PUBLISHED_PAGE_START,
      { beforeAt: edge.published_at ?? '', beforeId: edge.id },
    ]);
    expect(page.limit()).toBe(CONTENT_PAGE_SIZE * 2);
    expect(page.hasMore()).toBe(false);
    dispose();
  });
});
