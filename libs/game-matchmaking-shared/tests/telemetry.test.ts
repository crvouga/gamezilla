import { expect, test } from 'bun:test';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import { recordGameTransition } from '@libs/game-matchmaking-shared/telemetry';
import { reconcileOutbox } from '@pkgs/outbox-shared/reconcile';
import { SqlClientImplBunSqlite } from '@pkgs/sql-client-sqlite-root-server/impl-bun-sqlite';
import sql from '@pkgs/sql-root-shared/sql';

const game: MultiplayerGame = {
  id: 'game-1',
  white_id: 'white-user',
  black_id: 'black-user',
  fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  pgn: '',
  revision: 1,
  turn: 'white-user',
  outcome: 'ongoing',
  reason: null,
  time_control: null,
  white_ms: null,
  black_ms: null,
  clock_at_ms: null,
  paused_at_ms: null,
  draw_offer_by: null,
  rematch_offer_by: null,
  rematch_of: null,
  white_rating: null,
  black_rating: null,
  white_rating_diff: null,
  black_rating_diff: null,
  setup_ready: null,
};

test.each(['5+0', 'connect-four/5+0'])(
  'terminal telemetry is durable and logically deduplicated, with both participants pseudonymized',
  async (timeControl) => {
    const db = SqlClientImplBunSqlite.open(':memory:');
    await db.connect();
    try {
      await reconcileOutbox(db);
      const started = { ...game, time_control: timeControl, revision: 2 };
      const completed = { ...started, outcome: 'white' as const };
      await db.transaction(async (tx) => {
        await recordGameTransition(tx, {
          before: game,
          after: started,
          nowMs: 1000,
          synthetic: false,
        });
        await recordGameTransition(tx, {
          before: started,
          after: completed,
          nowMs: 2000,
          synthetic: false,
        });
        await recordGameTransition(tx, {
          before: started,
          after: completed,
          nowMs: 2000,
          synthetic: false,
        });
      });
      const rows = await db.query(
        sql<{
          type: string;
          payload: string;
        }>`SELECT type, payload FROM outbox_events ORDER BY type`
      );
      expect(rows).toHaveLength(2);
      expect(rows.filter((row) => row.type.includes('completed'))).toHaveLength(
        1
      );
      const serialized = JSON.stringify(rows);
      expect(serialized).not.toContain('white-user');
      expect(serialized).not.toContain('black-user');
      expect(serialized).not.toContain(game.fen);
      expect(serialized).toContain(timeControl);
    } finally {
      await db.disconnect();
    }
  }
);

test('a chosen private setup is observed by which sides are ready, never by the setup', async () => {
  const db = SqlClientImplBunSqlite.open(':memory:');
  await db.connect();
  try {
    await reconcileOutbox(db);
    const setup =
      'fleet:carrier@a1h;battleship@a3h;cruiser@a5h;submarine@a7h;destroyer@a9h';
    const paired = { ...game, revision: 0, setup_ready: '' };
    const white = { ...paired, setup_ready: 'white' };
    const both = { ...paired, setup_ready: 'white,black' };
    await db.transaction(async (tx) => {
      await recordGameTransition(tx, {
        before: paired,
        after: white,
        nowMs: 1000,
      });
      await recordGameTransition(tx, {
        before: white,
        after: both,
        nowMs: 2000,
      });
      await recordGameTransition(tx, {
        before: white,
        after: both,
        nowMs: 2000,
      });
    });
    const rows = await db.query(
      sql<{
        type: string;
        payload: string;
      }>`SELECT type, payload FROM outbox_events ORDER BY created_at`
    );
    expect(rows.filter((row) => row.type.includes('setup'))).toHaveLength(2);
    const serialized = JSON.stringify(rows);
    expect(serialized).toContain('white,black');
    expect(serialized).not.toContain(setup);
    expect(serialized).not.toContain('white-user');
  } finally {
    await db.disconnect();
  }
});
