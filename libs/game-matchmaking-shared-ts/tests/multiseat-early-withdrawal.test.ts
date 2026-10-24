import { expect, test } from 'bun:test';
import { withdrawMultiplayer } from '@libs/game-matchmaking-shared-ts/account-privacy';
import { MULTIPLAYER_TABLES } from '@libs/game-matchmaking-shared-ts/multiplayer-tables';
import { openConformanceDb } from '@libs/permissions-shared-ts/world';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationCtx } from '@pkgs/sync-engine-shared-ts/mutations-types';
import { MULTISEAT_GAMES } from './multiseat-fixture';

// regression: multiseat-early-withdrawal
test.each(['alice', 'bob', 'carol', 'dave'])(
  'withdrawal by %s before the first move completes a four-person draw',
  async (actorId) => {
    const db = await openConformanceDb(MULTIPLAYER_TABLES);
    try {
      await db.run(sql`INSERT INTO chess_multiplayer_games
        (id, white_id, black_id, red_id, blue_id, fen, pgn, revision, turn, outcome, paused_at_ms, setup_ready)
        VALUES (${'match'}, ${'alice'}, ${'bob'}, ${'carol'}, ${'dave'}, ${'four-seat-reference:0'}, ${''}, ${0}, ${'alice'}, ${'ongoing'}, ${null}, ${null})`);
      await db.transaction((tx) =>
        withdrawMultiplayer({
          tx,
          env: {
            actorId,
            now: () => new Date(1000),
            createId: () => 'withdrawal-event',
            turnGames: MULTISEAT_GAMES,
          },
        } as unknown as MutationCtx)
      );
      const rows = await db.query(sql<{
        outcome: string;
        reason: string;
        revision: number;
        white_id: string;
        black_id: string;
        red_id: string;
        blue_id: string;
      }>`SELECT outcome, reason, revision, white_id, black_id, red_id, blue_id
        FROM chess_multiplayer_games WHERE id = ${'match'}`);
      expect(rows[0]).toEqual({
        outcome: 'draw',
        reason: 'participant withdrew',
        revision: 0,
        white_id: 'alice',
        black_id: 'bob',
        red_id: 'carol',
        blue_id: 'dave',
      });
    } finally {
      await db.disconnect();
    }
  }
);
