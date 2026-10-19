/**
 * Every game's known puzzles in the one catalogue beside every other
 * game's: written through the catalogue writer, each enters its game's
 * namespace and a copy under another id is kept out as a duplicate; the
 * pool, the nearest read and the device's next pick for a game offer its
 * own puzzles and never another game's.
 */

import { expect, test } from 'bun:test';
import { BILLING_TABLES } from '@libs/billing-shared/tables';
import { buildPuzzleCandidatesSql } from '@libs/game-puzzle-shared/next-puzzle-selection';
import {
  chessPuzzleNearest,
  chessPuzzlePool,
} from '@libs/game-puzzle-shared/pool-query';
import {
  admitCataloguePuzzle,
  insertNewCatalogueRows,
} from '@libs/game-puzzle-shared/puzzle-catalogue';
import { PUZZLE_TABLES } from '@libs/game-puzzle-shared/puzzle-tables';
import { CASE_NOW_MS } from '@libs/permissions-shared/people';
import {
  mutationEnvFor,
  openConformanceDb,
} from '@libs/permissions-shared/world';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import type { Sql } from '@pkgs/sql-root-shared/sql';
import type { QueryRow } from '@pkgs/sync-engine-shared/v2';
import type { PuzzleRecord } from '@pkgs/turn-game-shared/game-puzzles';
import { createTurnGames } from '@pkgs/turn-game-shared/game-rules';
import { CONFORMANCE_GAMES } from '../../conformance-world';
import { forEveryGame } from '../game-suite';
import { puzzleCase } from './puzzle-room';

const GAMES = createTurnGames(
  CONFORMANCE_GAMES.map((game) => game.shared.turnGame)
);

const ALL_KNOWN = CONFORMANCE_GAMES.flatMap((game) =>
  (game.fixtures.puzzles ?? []).map((fixture) => fixture.record)
);

function admitted(record: PuzzleRecord) {
  const admission = admitCataloguePuzzle(GAMES, {
    record,
    source: { url: null, tags: [] },
  });
  if (!admission.ok) throw new Error(admission.detail);
  return admission.row;
}

/** A catalogue holding every conformance game's known puzzles. */
async function catalogue(): Promise<SqlClient> {
  const db = await openConformanceDb([...BILLING_TABLES, ...PUZZLE_TABLES]);
  expect(
    await insertNewCatalogueRows(
      db,
      ALL_KNOWN.map(admitted),
      '2026-01-01T00:00:00.000Z'
    )
  ).toBe(ALL_KNOWN.length);
  return db;
}

/** The ids a catalogue read returns for `params`, as the server runs it. */
async function idsOf(
  db: SqlClient,
  query: typeof chessPuzzlePool | typeof chessPuzzleNearest,
  params: Readonly<Record<string, unknown>>
): Promise<string[]> {
  const parsed = await query.params?.['~standard'].validate(params);
  if (parsed === undefined || parsed.issues !== undefined)
    throw new Error(`invalid params: ${JSON.stringify(params)}`);
  const tables = await query.run(
    {
      db: { query: (q) => db.query(q as Sql<QueryRow>) },
      env: mutationEnvFor('free account', CASE_NOW_MS),
    },
    parsed.value as never
  );
  return (tables['chess_puzzles'] ?? []).map((row) => String(row['id'])).sort();
}

forEveryGame(import.meta.path, (game) => {
  const { known, puzzles } = puzzleCase(game);
  const own = known.map((fixture) => fixture.record.id).sort();
  const namespace = puzzles.namespace;

  test('its known puzzles enter the catalogue, and a copy under another id is kept out', async () => {
    const db = await catalogue();
    try {
      const copies = known.map((fixture) =>
        admitted({ ...fixture.record, id: `${fixture.record.id}x` })
      );
      expect(
        await insertNewCatalogueRows(db, copies, '2026-01-02T00:00:00.000Z')
      ).toBe(0);
    } finally {
      await db.disconnect();
    }
  });

  test('the pool and the nearest read offer its own puzzles alone', async () => {
    const db = await catalogue();
    try {
      expect(await idsOf(db, chessPuzzlePool, { namespace })).toEqual(own);
      const rating = known[0].record.rating;
      const nearest = await idsOf(db, chessPuzzleNearest, {
        rating,
        namespace,
      });
      expect(nearest.length).toBeGreaterThan(0);
      for (const id of nearest) expect(own).toContain(id);
    } finally {
      await db.disconnect();
    }
  });

  test("the device's next pick offers its own puzzles alone", async () => {
    const db = await catalogue();
    try {
      const rows = await db.query(
        buildPuzzleCandidatesSql({
          namespace,
          rating: 1500,
          halfWindow: 1500,
          ownerId: 'someone',
          historyFilter: 'any',
          themes: [],
          currentPuzzleId: null,
        })
      );
      expect(rows.map((row) => String(row.id)).sort()).toEqual(own);
    } finally {
      await db.disconnect();
    }
  });
});
