import { expect, test } from 'bun:test';
import { createPublishedPage } from '@libs/game-puzzle-client-ts/use-content-pages';
import {
  CONTENT_PAGE_SIZE,
  PUBLISHED_PAGE_START,
} from '@libs/game-puzzle-shared-ts/content-query-scope';
import type { ContentDocument } from '@libs/game-puzzle-shared-ts/content-types';
import { createRoot, createSignal, flush } from 'solid-js';

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
  const rows = Array.from({ length: CONTENT_PAGE_SIZE + 8 }, (_, index) =>
    publication(index)
  ).toReversed();
  const { page, dispose } = createRoot((dispose) => ({
    page: createPublishedPage(() => rows),
    dispose,
  }));
  try {
    expect(page.cursors()).toEqual([PUBLISHED_PAGE_START]);
    expect(page.hasMore()).toBe(true);
    page.more();
    page.more();
    flush();
    const edge = publication(8);
    expect(page.cursors()).toEqual([
      PUBLISHED_PAGE_START,
      { beforeAt: edge.published_at ?? '', beforeId: edge.id },
    ]);
    expect(page.documents()).toEqual(rows);
    expect(page.hasMore()).toBe(false);
  } finally {
    dispose();
  }
});

// regression: bundled-puzzles-offer-more-publications
test('Browse waits for the published pack when a full page of starter puzzles is already on the device', () => {
  const starters = Array.from(
    { length: CONTENT_PAGE_SIZE },
    (_, index): ContentDocument => ({
      ...publication(index),
      id: `bundled:pile:warehouse-${index}`,
      kind: 'puzzle',
      owner_id: 'bundled',
      published_revision_id: `bundled:pile:warehouse-${index}:edition`,
      published_at: null,
    })
  );
  const { page, setRows, dispose } = createRoot((dispose) => {
    const [rows, setRows] = createSignal<readonly ContentDocument[]>(starters);
    return { page: createPublishedPage(rows), setRows, dispose };
  });
  try {
    expect(page.hasMore()).toBe(false);
    expect(page.documents()).toEqual([]);
    const publications = ['Lift', 'Ramp', 'Warehouse'].map(
      (id, index): ContentDocument => ({
        ...publication(index),
        kind: id === 'Warehouse' ? 'pack' : 'puzzle',
        id,
      })
    );
    setRows([
      ...starters,
      { ...publication(5), published_revision_id: null },
      ...publications,
    ]);
    flush();
    expect(page.hasMore()).toBe(false);
    expect(page.documents()).toEqual(publications.toReversed());
    page.more();
    flush();
    expect(page.cursors()).toEqual([PUBLISHED_PAGE_START]);
  } finally {
    dispose();
  }
});
