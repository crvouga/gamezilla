/**
 * Each game's puzzles in its own share of the one catalogue: a puzzle is
 * admitted only into the namespace of the game that recognises it and as
 * that game validates it, every read of the catalogue sees only the game's
 * namespace — on the device's SQLite and the server's Postgres alike — and
 * a person's rating and feed settings are kept per game.
 *
 * Two registered games: the platform's durable game (the unprefixed
 * namespace, as chess's stored puzzles are) and a second one in `pile/`.
 */

import { describe, expect, test } from 'bun:test';
import { BILLING_TABLES } from '@libs/billing-shared-ts/tables';
import { GAME_PLATFORM_NAMESPACE } from '@libs/game-matchmaking-shared-ts/durable-names';
import { buildPuzzleCandidatesSql } from '@libs/game-puzzle-shared-ts/next-puzzle-selection';
import {
  chessPuzzleNearest,
  chessPuzzlePool,
} from '@libs/game-puzzle-shared-ts/pool-query';
import type { CataloguePuzzle } from '@libs/game-puzzle-shared-ts/puzzle-catalogue';
import {
  admitCataloguePuzzle,
  insertNewCatalogueRows,
  upsertCatalogueRows,
} from '@libs/game-puzzle-shared-ts/puzzle-catalogue';
import {
  isPuzzleNamespace,
  puzzleNamespaceOf,
  puzzleOwnerKey,
} from '@libs/game-puzzle-shared-ts/puzzle-namespace';
import { PUZZLE_TABLES } from '@libs/game-puzzle-shared-ts/puzzle-tables';
import { ratePuzzleAttemptMutation } from '@libs/game-puzzle-shared-ts/rate-puzzle-attempt-mutation';
import { PUZZLE_SCORE_PERMILLE } from '@libs/game-puzzle-shared-ts/rating';
import { savePuzzleFeedSettingsMutation } from '@libs/game-puzzle-shared-ts/save-puzzle-feed-settings-mutation';
import { uniqueTables } from '@libs/permissions-shared-ts/world';
import { createMockingbirdPostgresTestClient } from '@pkgs/db-schema-postgres-server-ts/mockingbird-postgres-test-client';
import { reconcilePostgresSchema } from '@pkgs/db-schema-postgres-shared-ts/reconcile-postgres-schema';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import type { Sql } from '@pkgs/sql-root-shared-ts/sql';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { MutationEnv } from '@pkgs/sync-engine-shared-ts/mutations-types';
import type { QueryRow } from '@pkgs/sync-engine-shared-ts/v2';
import { createTurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { pilePuzzles, pileRules } from './pile-game';

const DURABLE = GAME_PLATFORM_NAMESPACE;
const GAMES = createTurnGames([
  {
    rules: pileRules(DURABLE),
    capabilities: { puzzles: pilePuzzles('') },
    unprefixedNamespace: true,
  },
  { rules: pileRules('pile'), capabilities: { puzzles: pilePuzzles('pile/') } },
]);

function puzzle(
  id: string,
  position: string,
  line: readonly string[] = ['take1', 'take2']
): CataloguePuzzle {
  return {
    record: {
      id,
      position,
      line,
      rating: 1500,
      ratingDeviation: 80,
      popularity: 90,
      plays: 100,
      themes: ['endgame', 'short'],
    },
    source: { url: null, tags: [] },
  };
}

const DURABLE_PUZZLE = puzzle('AbC12', `${DURABLE}:7:black`);
const PILE_PUZZLE = puzzle('pile/7', 'pile:7:black');

function admitted(entry: CataloguePuzzle) {
  const admission = admitCataloguePuzzle(GAMES, entry);
  if (!admission.ok) throw new Error(admission.detail);
  return admission.row;
}

describe('namespaces', () => {
  test("a game's namespace is '' or its id and a slash", () => {
    expect(isPuzzleNamespace('')).toBe(true);
    expect(isPuzzleNamespace('pile/')).toBe(true);
    for (const bad of ['pile', 'Pile/', 'pi_le/', 'pile//', '%/'])
      expect(isPuzzleNamespace(bad)).toBe(false);
    expect(puzzleNamespaceOf('AbC12')).toBe('');
    expect(puzzleNamespaceOf('pile/7')).toBe('pile/');
    expect(puzzleOwnerKey('', 'user_1')).toBe('user_1');
    expect(puzzleOwnerKey('pile/', 'user_1')).toBe('pile/user_1');
  });
});

describe('admitting a puzzle into the catalogue', () => {
  test("each game's puzzle enters its own namespace, as a stored row", () => {
    const row: Readonly<Record<string, unknown>> = { ...admitted(PILE_PUZZLE) };
    expect(row).toEqual({
      id: 'pile/7',
      fen: 'pile:7:black',
      moves: 'take1 take2',
      rating: 1500,
      rating_deviation: 80,
      popularity: 90,
      nb_plays: 100,
      themes: '["endgame","short"]',
      game_url: null,
      opening_tags: '[]',
      position_key: 'pile:7:black take1 take2',
    });
    expect(admitted(DURABLE_PUZZLE).id).toBe('AbC12');
  });

  test('a namespace no game offers puzzles in is refused', () => {
    expect(
      admitCataloguePuzzle(GAMES, puzzle('race/1', 'pile:7:black'))
    ).toMatchObject({ ok: false, reason: 'namespace' });
  });

  test("a position the namespace's game does not recognise is refused", () => {
    expect(
      admitCataloguePuzzle(GAMES, puzzle('pile/8', `${DURABLE}:7:black`))
    ).toMatchObject({ ok: false, reason: 'position' });
    expect(
      admitCataloguePuzzle(GAMES, puzzle('xyz99', 'pile:7:black'))
    ).toMatchObject({ ok: false, reason: 'position' });
  });

  test("a puzzle the game's content validation refuses is refused", () => {
    expect(
      admitCataloguePuzzle(
        GAMES,
        puzzle('pile/9', 'pile:7:black', ['take1', 'bad'])
      )
    ).toEqual({
      ok: false,
      reason: 'content',
      detail: 'pile/9: badMove: the line names bad',
    });
  });
});

const OWNER = 'user_1';

function env(): MutationEnv {
  return {
    actorId: OWNER,
    deviceId: 'device_1',
    accountId: OWNER,
    isAnon: false,
    now: () => new Date(1_700_000_000_000),
    createId: () => 'unused',
  };
}

const TABLES = registerTables(
  uniqueTables([...BILLING_TABLES, ...PUZZLE_TABLES])
);

async function openSqlite(): Promise<SqlClient> {
  const db = SqlClientImplMockingbirdSqlite.open();
  await db.connect();
  await reconcileSqliteSchema(db, TABLES, { ownership: 'declared-only' });
  return db;
}

async function openPostgres(): Promise<SqlClient> {
  const { sqlClient } =
    await createMockingbirdPostgresTestClient('puzzle_catalogue');
  await reconcilePostgresSchema(sqlClient, TABLES, sqlClient.dbScope);
  return sqlClient;
}

/** One puzzle of each game, then a second of each (a seed and an import). */
async function writeCatalogue(db: SqlClient): Promise<void> {
  expect(
    await insertNewCatalogueRows(
      db,
      [admitted(DURABLE_PUZZLE), admitted(PILE_PUZZLE)],
      '2024-01-01T00:00:00.000Z'
    )
  ).toBe(2);
  await upsertCatalogueRows(db, [
    admitted(puzzle('ZzZ99', `${DURABLE}:8:black`)),
    admitted(puzzle('pile/8', 'pile:8:black')),
  ]);
}

type CatalogueQuery = typeof chessPuzzlePool | typeof chessPuzzleNearest;

/** The ids a catalogue query returns for `params`, as the server runs it. */
async function idsOf(
  db: SqlClient,
  query: CatalogueQuery,
  params: Readonly<Record<string, unknown>>
): Promise<string[]> {
  const parsed = await query.params?.['~standard'].validate(params);
  if (parsed === undefined || parsed.issues !== undefined)
    throw new Error(`invalid params: ${JSON.stringify(params)}`);
  const tables = await query.run(
    { db: { query: (q) => db.query(q as Sql<QueryRow>) }, env: env() },
    parsed.value as never
  );
  return (tables['chess_puzzles'] ?? []).map((row) => String(row['id'])).sort();
}

async function refuses(
  query: CatalogueQuery,
  params: Readonly<Record<string, unknown>>
): Promise<boolean> {
  const parsed = await query.params?.['~standard'].validate(params);
  return parsed?.issues !== undefined;
}

describe.each([
  ['SQLite', openSqlite],
  ['Postgres', openPostgres],
])('reading the catalogue (%s)', (_dialect, open) => {
  test('the pool reads only the game namespace asked for', async () => {
    const db = await open();
    await writeCatalogue(db);
    const band = { ratingMin: 1200, ratingMax: 1599 };
    // A device that names no namespace reads the durable game's, as before.
    expect(await idsOf(db, chessPuzzlePool, band)).toEqual(['AbC12', 'ZzZ99']);
    expect(
      await idsOf(db, chessPuzzlePool, { ...band, namespace: '' })
    ).toEqual(['AbC12', 'ZzZ99']);
    expect(
      await idsOf(db, chessPuzzlePool, { ...band, namespace: 'pile/' })
    ).toEqual(['pile/7', 'pile/8']);
    expect(
      await idsOf(db, chessPuzzleNearest, { rating: 1500, namespace: 'pile/' })
    ).toEqual(['pile/7', 'pile/8']);
    expect(await refuses(chessPuzzlePool, { namespace: 'p%/' })).toBe(true);
  });
});

describe("the device's next-puzzle pick", () => {
  test("offers only the game's own puzzles", async () => {
    const db = await openSqlite();
    await writeCatalogue(db);
    const pick = (namespace: string) =>
      db.query(
        buildPuzzleCandidatesSql({
          namespace,
          rating: 1500,
          halfWindow: 200,
          ownerId: OWNER,
          historyFilter: 'any',
          themes: [],
          currentPuzzleId: null,
        })
      );
    expect((await pick('')).map((row) => row.id).sort()).toEqual([
      'AbC12',
      'ZzZ99',
    ]);
    expect((await pick('pile/')).map((row) => row.id).sort()).toEqual([
      'pile/7',
      'pile/8',
    ]);
  });
});

describe("a person's progress, per game", () => {
  test("a rated attempt moves only the rating of the puzzle's game", async () => {
    const db = await openSqlite();
    const run = async (puzzleId: string, attemptKey: string) => {
      const parsed = await ratePuzzleAttemptMutation.args['~standard'].validate(
        {
          attemptKey,
          solveIdx: 1,
          ownerId: OWNER,
          puzzleId,
          puzzleRating: 1500,
          puzzleRatingDeviation: 80,
          outcome: 'solved',
          scorePermille: PUZZLE_SCORE_PERMILLE.win,
        }
      );
      if (parsed.issues !== undefined) throw new Error('invalid rating args');
      await ratePuzzleAttemptMutation.run({ tx: db, env: env() }, parsed.value);
    };
    await run('pile/7', 'a1');
    const profiles = () =>
      db.query(sql<{ readonly id: string; readonly owner_id: string }>`
        SELECT id, owner_id FROM chess_puzzle_profiles ORDER BY id
      `);
    expect(await profiles()).toEqual([{ id: 'pile/user_1', owner_id: OWNER }]);
    await run('AbC12', 'a2');
    expect(await profiles()).toEqual([
      { id: 'pile/user_1', owner_id: OWNER },
      { id: 'user_1', owner_id: OWNER },
    ]);
  });

  test("feed settings are saved per game, the durable game's under the person's id", async () => {
    const db = await openSqlite();
    const save = async (args: Record<string, unknown>) => {
      const parsed =
        await savePuzzleFeedSettingsMutation.args['~standard'].validate(args);
      if (parsed.issues !== undefined) throw new Error('invalid settings');
      await savePuzzleFeedSettingsMutation.run(
        { tx: db, env: env() },
        parsed.value
      );
    };
    const config = JSON.stringify({ mode: 'auto', customRating: 1500 });
    await save({ config });
    await save({ config, namespace: 'pile/' });
    expect(
      await db.query(sql<{ readonly id: string; readonly owner_id: string }>`
        SELECT id, owner_id FROM chess_puzzle_feed_settings ORDER BY id
      `)
    ).toEqual([
      { id: 'pile/user_1', owner_id: OWNER },
      { id: 'user_1', owner_id: OWNER },
    ]);
  });
});
