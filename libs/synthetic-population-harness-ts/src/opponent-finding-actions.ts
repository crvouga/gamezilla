/**
 * People looking for a multiplayer opponent while the scenario's Synthetic
 * Users carry on, and what each of them sees come of it.
 */
import { multiplayerView } from '@libs/game-matchmaking-harness-ts/multiplayer-reads';
import { requestGameOpponent } from '@libs/game-matchmaking-harness-ts/multiplayer-search-ui';
import {
  givenGameSpace,
  openFindingAnOpponent,
  seekGameOpponent,
} from '@libs/game-matchmaking-harness-ts/opponent-seeking';
import { defaultMatchChoice } from '@libs/game-matchmaking-shared-ts/match-choice';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { bringToFront } from '@libs/harness-ts/observations';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { carryOnSyntheticUsers } from './live-synthetic-users';
import { syntheticGame } from './synthetic-game-actions';

/** Long enough for any rule about finding an opponent to have played out. */
const LOOKING_WINDOW_MS = 45_000;

type Looking = { startedAt: number; matchedAt: number | null };
const lookings = new WeakMap<ProductHarness, Map<string, Looking>>();

function lookingOf(s: ProductHarness): Map<string, Looking> {
  const known = lookings.get(s);
  if (known !== undefined) return known;
  const fresh = new Map<string, Looking>();
  lookings.set(s, fresh);
  return fresh;
}

/** The registered id of the game a scenario names. */
export function gameIdOf(name: string): string {
  return syntheticGame(name).shared.id;
}

/**
 * How many outside the scenario's cast (everyone it has named so far) are
 * looking for a multiplayer opponent for the game.
 */
export async function lookingForOpponent(
  s: ProductHarness,
  game: string
): Promise<number> {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      owner_id: string;
      data: unknown;
    }>`SELECT s.owner_id, w.data FROM chess_opponent_searches AS s JOIN matchmaking_waiting AS w ON w.id = s.search_id WHERE s.standing = ${'waiting'} AND s.deleted_at IS NULL AND w.deleted_at IS NULL`
  );
  const cast = new Set<string | null>();
  for (const actor of s.actors.keys())
    cast.add(await signedInAccountOf(s, actor));
  const id = gameIdOf(game);
  return rows.filter((row) => {
    if (cast.has(row.owner_id)) return false;
    const data = typeof row.data === 'string' ? JSON.parse(row.data) : row.data;
    const pool = (data as Record<string, unknown> | null)?.['matchmaking/pool'];
    return typeof pool === 'string' && pool.startsWith(`${id}.`);
  }).length;
}

async function inGame(s: ProductHarness, actor: string): Promise<boolean> {
  const game = (await multiplayerView(s, actor)).game;
  return game !== null && game.outcome === 'ongoing';
}

/**
 * A person looks for a multiplayer opponent for the game, as people do, and
 * the Synthetic Users carry on meanwhile until the person has an opponent
 * or long enough has passed for every rule to have played out.
 */
export const lookForMultiplayerOpponent = scenarioAction({
  name: 'lookForMultiplayerOpponent',
  act: async (s, actor: string, game: string) => {
    const looking: Looking = {
      startedAt: s.harness.clock.now(),
      matchedAt: null,
    };
    lookingOf(s).set(actor, looking);
    if ((await signedInAccountOf(s, actor)) === null)
      await Promise.resolve(seekGameOpponent.act(s, actor, gameIdOf(game)));
    else await seekAgain(s, actor, game);
    await carryOnSyntheticUsers(s, {
      maxMs: LOOKING_WINDOW_MS,
      observe: async () => {
        if (looking.matchedAt === null && (await inGame(s, actor)))
          looking.matchedAt = s.harness.clock.now();
      },
      settled: async () => looking.matchedAt !== null,
    });
  },
});

/** A signed-in person looks again, from their own space, as they first did. */
async function seekAgain(s: ProductHarness, actor: string, game: string) {
  const matched = syntheticGame(game).shared.capabilities.matchmaking;
  if (matched === undefined) throw new Error(`${game} offers no matchmaking`);
  await Promise.resolve(givenGameSpace.act(s, actor));
  await Promise.resolve(openFindingAnOpponent.act(s, actor, gameIdOf(game)));
  const ui = await actorUi(s, actor);
  // After a game, a person finds their next opponent from its result.
  if (await ui.get('multiplayer-new-opponent').isVisible()) {
    await ui.get('multiplayer-new-opponent').tap();
    return;
  }
  await Promise.resolve(
    requestGameOpponent.act(s, actor, defaultMatchChoice(matched))
  );
}

/** The Synthetic User, by its scenario name, whose account `accountId` is. */
async function nameOfAccount(
  s: ProductHarness,
  accountId: string | null
): Promise<string | null> {
  if (accountId === null) return null;
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      username: string;
    }>`SELECT username FROM population_users WHERE account_id = ${accountId} AND deleted_at IS NULL`
  );
  return rows[0]?.username ?? accountId;
}

/**
 * Whom `actor` sees as their multiplayer opponent, and how long after they
 * started looking their game began; `null` while they have none.
 */
export async function multiplayerOpponentShown(
  s: ProductHarness,
  actor: string
): Promise<{ opponent: string; afterMs: number | null } | null> {
  await bringToFront(s, actor);
  const own = await signedInAccountOf(s, actor);
  const game = (await multiplayerView(s, actor)).game;
  if (game === null || own === null || game.outcome !== 'ongoing') return null;
  const other = [game.white_id, game.black_id].find(
    (id) => id !== null && id !== own
  );
  const opponent = await nameOfAccount(s, other ?? null);
  if (opponent === null) return null;
  const looking = lookingOf(s).get(actor);
  return {
    opponent,
    afterMs:
      looking?.matchedAt === null || looking === undefined
        ? null
        : looking.matchedAt - looking.startedAt,
  };
}

/** Whether `actor` is still looking for an opponent, as their screen says, and for how long. */
export async function stillLookingShown(s: ProductHarness, actor: string) {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  const waiting = ui.get('multiplayer-waiting');
  if (!(await waiting.isVisible()))
    return { looking: false, told: null, seconds: 0 };
  return {
    looking: true,
    told: await waiting.text(),
    seconds: Number(
      (await ui.get('multiplayer-waiting-seconds').text()) ?? '0'
    ),
  };
}
