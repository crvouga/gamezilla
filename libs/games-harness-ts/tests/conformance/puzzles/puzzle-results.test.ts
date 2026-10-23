/**
 * The result of an attempt at every game's known puzzles, as the owner's
 * device records it and the server replays it: the rating moves once, in
 * the profile of the puzzle's game, however often the result is uploaded
 * (a device back online, a retried upload); a later attempt at the same
 * puzzle leaves the rating alone; and an attempt keeps its first result.
 */

import { expect, test } from 'bun:test';
import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { puzzleOwnerKey } from '@libs/game-puzzle-shared-ts/puzzle-namespace';
import { PUZZLE_TABLES } from '@libs/game-puzzle-shared-ts/puzzle-tables';
import { ratePuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/rate-puzzle-attempt-mutation';
import { authorizeAppMutation } from '@libs/permissions-shared-ts/authorize-app-mutation';
import { CASE_NOW_MS, DMN_INPUT } from '@libs/permissions-shared-ts/people';
import type { ServerCase } from '@libs/permissions-shared-ts/server';
import { replayOperation } from '@libs/permissions-shared-ts/server';
import {
  mutationEnvFor,
  openConformanceDb,
  seedAccess,
} from '@libs/permissions-shared-ts/world';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { PuzzleRecord } from '@pkgs/turn-game-shared-ts/game-puzzles';
import { forEveryGame } from '../game-suite';
import { puzzleCase } from './puzzle-room';

const PERSON = 'free account';

/** A server, or a device's own database, for a signed-in person. */
async function open(): Promise<ServerCase> {
  const input = { [DMN_INPUT.who]: PERSON };
  const db = await openConformanceDb([...BILLING_TABLES, ...PUZZLE_TABLES]);
  await seedAccess(db, { input, nowMs: CASE_NOW_MS });
  return {
    db,
    env: mutationEnvFor(PERSON, CASE_NOW_MS),
    input,
    nowMs: CASE_NOW_MS,
    guard: authorizeAppMutation,
  };
}

type Outcome = 'solved' | 'failed';

function rate(record: PuzzleRecord, attemptKey: string, outcome: Outcome) {
  return replayOperation(ratePuzzleAttemptMutation, (c) => ({
    attemptKey,
    solveIdx: record.line.length,
    ownerId: c.env.actorId,
    puzzleId: record.id,
    puzzleRating: record.rating,
    puzzleRatingDeviation: record.ratingDeviation,
    outcome,
    scorePermille: outcome === 'solved' ? 1000 : 0,
  }));
}

async function ledger(c: ServerCase, record: PuzzleRecord) {
  const events = await c.db.query(sql<{ readonly id: string }>`
    SELECT id FROM chess_puzzle_rating_events
    WHERE owner_id = ${c.env.actorId} AND puzzle_id = ${record.id}
  `);
  const profiles = await c.db.query(
    sql<{
      readonly id: string;
      readonly rating: number;
    }>`SELECT id, rating FROM chess_puzzle_profiles ORDER BY id`
  );
  return { events: events.length, profiles };
}

async function refusal(run: Promise<void>): Promise<string | null> {
  try {
    await run;
    return null;
  } catch (error) {
    if (error instanceof MutationError) return error.code;
    throw error;
  }
}

forEveryGame(import.meta.path, (game) => {
  const { known, puzzles } = puzzleCase(game);
  const { record } = known[0];

  test("a result uploaded again and again rates once, in its game's profile, as on the device", async () => {
    const device = await open();
    const server = await open();
    try {
      await rate(record, 'attempt-1', 'solved')(device);
      for (let upload = 0; upload < 3; upload += 1)
        await rate(record, 'attempt-1', 'solved')(server);
      const recorded = await ledger(server, record);
      expect(recorded.events).toBe(1);
      expect(recorded.profiles.map((profile) => profile.id)).toEqual([
        puzzleOwnerKey(puzzles.namespace, server.env.actorId),
      ]);
      expect(recorded.profiles).toEqual(
        (await ledger(device, record)).profiles
      );
    } finally {
      await device.db.disconnect();
      await server.db.disconnect();
    }
  });

  test('a later attempt at the same puzzle leaves the rating alone', async () => {
    const server = await open();
    try {
      await rate(record, 'attempt-1', 'solved')(server);
      const before = await ledger(server, record);
      await rate(record, 'attempt-2', 'failed')(server);
      expect(await ledger(server, record)).toEqual(before);
    } finally {
      await server.db.disconnect();
    }
  });

  test('an attempt keeps its first result: a different one is refused, the same one recorded once', async () => {
    const server = await open();
    try {
      await rate(record, 'attempt-1', 'failed')(server);
      expect(await refusal(rate(record, 'attempt-1', 'solved')(server))).toBe(
        'CHESS_ATTEMPT_ALREADY_FINISHED'
      );
      await rate(record, 'attempt-1', 'failed')(server);
      const rows = await server.db.query(sql<{ readonly id: string }>`
        SELECT id FROM chess_puzzle_interactions WHERE puzzle_id = ${record.id}
      `);
      expect(rows.map((row) => row.id)).toEqual([
        `${server.env.actorId}|attempt-1`,
      ]);
    } finally {
      await server.db.disconnect();
    }
  });
});
