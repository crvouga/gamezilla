import { expect, test } from 'bun:test';
import { publishMultiplayerFixture } from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import { MultiplayerGameChanged } from '@libs/chess-matchmaking-shared/match-room';
import { CHESS_MULTIPLAYER_TABLES } from '@libs/chess-matchmaking-shared/multiplayer-tables';
import { openConformanceDb } from '@libs/permissions-shared/world';
import { outboxEvents } from '@pkgs/outbox-shared/tables';
import sql from '@pkgs/sql-root-shared/sql';

// regression: multiplayer-clock-fixture-room-stale
test('an eleven-second clock fixture publishes its accepted position to the match room', async () => {
  const db = await openConformanceDb([
    ...CHESS_MULTIPLAYER_TABLES,
    outboxEvents,
  ]);
  const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
  try {
    await db.run(sql`
      INSERT INTO chess_multiplayer_games
        (id, white_id, black_id, fen, pgn, revision, turn, outcome, time_control, white_ms, black_ms, clock_at_ms)
      VALUES (${'game'}, ${'alice'}, ${'bob'}, ${fen}, ${'1. e4 e5'}, ${2}, ${'alice'}, ${'ongoing'}, ${'2+1'}, ${11_000}, ${120_000}, ${1_000})`);
    expect(
      await publishMultiplayerFixture(db, 'game', {
        actorId: 'alice',
        accountId: 'alice',
        deviceId: '',
        isAnon: false,
        now: () => new Date(1_000),
        createId: () => 'accepted-game',
      })
    ).toEqual(['alice', 'bob']);
    const delivered = await db.query(sql<{ payload: string }>`
      SELECT payload FROM outbox_events WHERE type = ${MultiplayerGameChanged.type} AND deleted_at IS NULL`);
    expect(delivered).toHaveLength(1);
    expect(JSON.parse(delivered[0]!.payload)).toMatchObject({
      id: 'game',
      fen,
      revision: 2,
      white_ms: 11_000,
      black_ms: 120_000,
      clock_at_ms: 1_000,
    });
  } finally {
    await db.disconnect();
  }
});
