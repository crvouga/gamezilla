import { expect, test } from 'bun:test';
import { multiplayerBoardShown } from '@libs/game-matchmaking-harness-ts/multiplayer-board';
import {
  multiplayerCommandReply,
  sendMultiplayerCommand,
} from '@libs/game-matchmaking-harness-ts/multiplayer-commands';
import {
  FANOUT_CONTROL,
  FANOUT_SYSTEM,
  observedServerRuntime,
  prepareFanoutFind,
  type Statement,
} from './matchmaking-fanout-fixture';

// The same product-harness wall-time contract as libs/harness-ts/scripts/test-spec.ts.
const PRODUCT_HARNESS_TIMEOUT_MS = 240_000;

test(
  'one real Find delivers both hosted boards without duplicate owner-space lookups',
  async () => {
    // regression: matchmaking-fanout-repeats-owner-lookups
    const statements: Statement[] = [];
    let recording = false;
    await using s = await FANOUT_SYSTEM.run({
      seed: 1,
      runtime: observedServerRuntime((query) => {
        if (recording)
          statements.push({ text: query.sql, values: [...query.values] });
      }),
    });
    await prepareFanoutFind(s);
    recording = true;
    await s.apply(sendMultiplayerCommand, 'bob', {
      name: 'findChessOpponent',
      args: { requestId: 'measured-final-find', timeControl: FANOUT_CONTROL },
    });
    recording = false;
    expect((await s.read(multiplayerCommandReply, 'bob'))?.result.ok).toBe(
      true
    );
    const formedAt = statements.findIndex((statement) =>
      /INSERT INTO chess_multiplayer_games\b/i.test(statement.text)
    );
    expect(formedAt).toBeGreaterThanOrEqual(0);
    const lookups = statements
      .slice(formedAt + 1)
      .filter((statement) =>
        /SELECT id FROM spaces WHERE host_member_id IN/i.test(statement.text)
      );
    const boards = await s.until(
      async (world) => {
        const shown = [];
        for (const actor of ['alice', 'bob', 'carol', 'dave'])
          shown.push(await multiplayerBoardShown(world, actor));
        return shown;
      },
      {
        maxMs: 5_000,
        pred: (shown) =>
          shown[0]?.gameId != null &&
          shown.every((board) => board.gameId === shown[0]?.gameId),
      }
    );
    expect(boards.map((board) => board.gameId)).toEqual(
      Array.from({ length: 4 }, () => boards[0]!.gameId)
    );
    // One owner-pair lookup and one lookup for each distinct owner suffice.
    expect(lookups.length).toBeLessThanOrEqual(3);
    const formationAt = statements.findIndex((statement) =>
      /SELECT DISTINCT w\.partition_signature/i.test(statement.text)
    );
    expect(formationAt).toBeGreaterThanOrEqual(0);
    const formation = statements.slice(formationAt);
    const completedAt = formation.findIndex((statement) =>
      /UPDATE\s+outbox_deliveries\s+SET processed_at/i.test(statement.text)
    );
    expect(completedAt).toBeGreaterThanOrEqual(0);
    // regression: match-formation-per-person-round-trips
    // Eligibility, ratings and roster writes can each resolve the whole pair.
    expect(formation.slice(0, completedAt).length).toBeLessThanOrEqual(27);
  },
  PRODUCT_HARNESS_TIMEOUT_MS
);
