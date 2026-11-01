import { Database } from 'bun:sqlite';
import { expect, test } from 'bun:test';
import { useContentPackChoiceReady } from '@libs/game-puzzle-client-ts/use-content-pack-choice-ready';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { SyncEngineProvider } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { SyncEngine } from '@pkgs/sync-engine-client-ts/sync-engine-port';
import { INITIAL_SYNC_STATUS } from '@pkgs/sync-engine-client-ts/sync-status';
import { type Accessor, createSignal } from 'solid-js';

// regression: published-pack-start-before-membership-hydration
test('a published pack waits for its local choice while bundled content stays ready', () => {
  using db = new Database(':memory:');
  db.run(`CREATE TABLE puzzle_content_pack_items (
    pack_revision_id TEXT, puzzle_revision_id TEXT, deleted_at TEXT
  )`);
  const listeners = new Set<() => void>();
  const engine = {
    watch: (query: { sql: string; values: readonly unknown[] }) => ({
      getSnapshot: () => db.query(query.sql).all(...(query.values as string[])),
      getHydrated: () => true,
      subscribe: (listener: () => void) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
    }),
    status: { getSnapshot: () => INITIAL_SYNC_STATUS },
  } as unknown as SyncEngine;
  const [pack, setPack] = createSignal<string | null>('published-pack');
  const [puzzle, setPuzzle] = createSignal('first-puzzle');
  let ready: Accessor<boolean> = () => {
    throw new Error('Not mounted');
  };
  const Probe = () => {
    ready = useContentPackChoiceReady(puzzle, pack);
    return null;
  };
  renderWithI18n(() => (
    <SyncEngineProvider value={engine}>
      <Probe />
    </SyncEngineProvider>
  ));
  expect(ready()).toBe(false);
  db.run('INSERT INTO puzzle_content_pack_items VALUES (?, ?, NULL)', [
    'published-pack',
    'first-puzzle',
  ]);
  for (const listener of listeners) listener();
  expect(ready()).toBe(true);
  setPuzzle('second-puzzle');
  expect(ready()).toBe(false);
  setPuzzle('first-puzzle');
  db.run("UPDATE puzzle_content_pack_items SET deleted_at = '2026-11-01'");
  for (const listener of listeners) listener();
  expect(ready()).toBe(false);
  setPack('bundled:sokoban:starter:edition');
  expect(ready()).toBe(true);
  setPack(null);
  expect(ready()).toBe(true);
});
