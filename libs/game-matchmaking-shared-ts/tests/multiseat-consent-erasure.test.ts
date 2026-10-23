import { expect, test } from 'bun:test';
import {
  eraseMultiplayer,
  withdrawMultiplayer,
} from '@libs/game-matchmaking-shared-ts/account-privacy';
import { MULTIPLAYER_TABLES } from '@libs/game-matchmaking-shared-ts/multiplayer-tables';
import { openConformanceDb } from '@libs/permissions-shared-ts/world';
import { reconcileOutbox } from '@pkgs/outbox-shared-ts/reconcile';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationCtx } from '@pkgs/sync-engine-shared-ts/mutations-types';

// regression: multiseat-consent-erasure
test.each([
  ['withdraw', withdrawMultiplayer],
  ['erase', eraseMultiplayer],
] as const)(
  '%s removes every pending agreement from an affected finished round before publishing it',
  async (operation, apply) => {
    const db = await openConformanceDb(MULTIPLAYER_TABLES);
    try {
      await reconcileOutbox(db);
      await db.run(sql`INSERT INTO chess_multiplayer_games
        (id, white_id, black_id, red_id, blue_id, fen, pgn, revision, turn, outcome, reason, paused_at_ms, setup_ready,
          draw_offer_by, rematch_offer_by, draw_votes, rematch_votes)
        VALUES (${'match'}, ${'alice'}, ${'bob'}, ${'carol'}, ${'dave'}, ${'reference:4'}, ${''}, ${4}, ${''}, ${'draw'}, ${'agreement'}, ${null}, ${null},
          ${'alice'}, ${'alice'}, ${'["alice","bob","carol"]'}, ${'["alice","bob","carol"]'})`);
      await db.transaction((tx) =>
        apply({
          tx,
          env: {
            actorId: 'carol',
            now: () => new Date(1000),
            serverNow: operation === 'erase' ? () => new Date(1000) : undefined,
            createId: () => 'erasure-event',
          },
        } as unknown as MutationCtx)
      );
      const rows = await db.query(sql<{
        draw_offer_by: string;
        rematch_offer_by: string;
        draw_votes: string | null;
        rematch_votes: string | null;
      }>`
        SELECT draw_offer_by, rematch_offer_by, draw_votes, rematch_votes FROM chess_multiplayer_games WHERE id = ${'match'}`);
      expect(rows[0]).toEqual({
        draw_offer_by: '',
        rematch_offer_by: '',
        draw_votes: null,
        rematch_votes: null,
      });
      if (operation === 'erase') {
        const events = await db.query(
          sql<{ payload: string }>`SELECT payload FROM outbox_events`
        );
        expect(events).toHaveLength(1);
        expect(events[0]?.payload).not.toContain('carol');
      }
    } finally {
      await db.disconnect();
    }
  }
);
