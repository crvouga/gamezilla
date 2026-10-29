import { expect, test } from 'bun:test';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { fanoutRowsForCapture } from '@pkgs/sync-engine-shared-ts/select-fanout-rows';

const noDb = {
  query: () => Promise.reject(new Error('no read expected')),
} as unknown as SqlClient;

const game = { id: 'g1', fen: 'battleship', setup_ready: 'red' };

// regression: private-setup-dropped-from-partial-fanout
test('a write without post-images makes the push carry none, so readers refetch', async () => {
  // Choosing a setup updates its game (RETURNING) and inserts the private
  // setup (no RETURNING): the game's image alone would be the push's news.
  expect(
    await fanoutRowsForCapture(noDb, {
      tables: ['chess_multiplayer_games', 'chess_multiplayer_setups'],
      ids: { chess_multiplayer_games: ['g1'] },
      images: { chess_multiplayer_games: [game] },
    })
  ).toBeUndefined();
  expect(
    await fanoutRowsForCapture(noDb, {
      tables: ['chess_multiplayer_games'],
      ids: { chess_multiplayer_games: ['g1'] },
      images: { chess_multiplayer_games: [game] },
    })
  ).toEqual({ chess_multiplayer_games: [game] });
});
