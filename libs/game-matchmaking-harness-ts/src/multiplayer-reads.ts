import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { MULTIPLAYER_GAME_COLUMNS } from '@libs/game-matchmaking-shared-ts/game-state';
import type { ClockSpeed } from '@libs/game-matchmaking-shared-ts/time-control';
import { gameSpeed } from '@libs/game-matchmaking-shared-ts/time-control';
import { actorUi } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import {
  actorLocalSql,
  localAccountIdOf,
  signedInAccountOf,
} from '@libs/harness-ts/identity';
import { bringToFront } from '@libs/harness-ts/observations';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';
import {
  multiplayerPlaceHolding,
  onMultiplayerPlace,
  returnToMultiplayerHome,
  showMultiplayerMoveList,
} from './multiplayer-places';

export type MultiplayerSearchView = {
  readonly search_id: string;
  readonly standing: string;
  readonly match_id: string | null;
  readonly time_control: string | null;
  readonly joined_at_ms: number | null;
};

export type MultiplayerRatingView = {
  readonly speed: string;
  readonly rating: number;
  readonly games: number;
};

const GAME_COLUMNS = raw(
  MULTIPLAYER_GAME_COLUMNS.map((column) => `g.${column}`).join(', ')
);

const NOTHING = { game: null, search: null, ratings: [] } as const;

/**
 * The account whose play the device shows. The server's verdict, while the
 * device can hear it; a device cut off from the server has not heard that
 * its session ended (its account deleted), so it still shows its own copy.
 */
async function shownAccountOf(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const live = await signedInAccountOf(s, actor);
  if (live !== null) return live;
  const cutOff =
    s.session.caps.has('partition') &&
    s.session.network.isPartitioned(s.harness.loadBalancer.id, actor);
  return cutOff ? localAccountIdOf(s, actor) : null;
}

/** What one device holds: the person's current game, search and own ratings. */
export async function multiplayerView(
  s: ProductHarness,
  actor: string
): Promise<{
  readonly game: MultiplayerGame | null;
  readonly search: MultiplayerSearchView | null;
  readonly ratings: readonly MultiplayerRatingView[];
}> {
  const db = actorLocalSql(s, actor);
  const owner = await shownAccountOf(s, actor);
  if (db === null || owner === null) return NOTHING;
  const games = await db.query(sql<MultiplayerGame>`SELECT ${GAME_COLUMNS}
    FROM chess_multiplayer_games AS g
    JOIN chess_multiplayer_players AS p ON p.game_id = g.id
    WHERE p.owner_id = ${owner} AND p.deleted_at IS NULL AND g.deleted_at IS NULL
      AND (g.white_id = ${owner} OR g.black_id = ${owner} OR g.red_id = ${owner} OR g.blue_id = ${owner})`);
  const searches = await db.query(sql<MultiplayerSearchView>`
    SELECT search_id, standing, match_id, time_control, joined_at_ms FROM chess_opponent_searches
    WHERE owner_id = ${owner} AND deleted_at IS NULL`);
  const ratings = await db.query(sql<MultiplayerRatingView>`
    SELECT speed, rating, games FROM chess_multiplayer_ratings
    WHERE owner_id = ${owner} AND deleted_at IS NULL ORDER BY speed`);
  return { game: games[0] ?? null, search: searches[0] ?? null, ratings };
}

/**
 * Whether `actor`'s device shows their matched game as the server holds it:
 * the same accepted moves and the same private setups ready. A device syncs
 * after the server changes, so two devices can agree on a game the server
 * has already moved on from.
 */
export async function multiplayerGameCaughtUp(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const shown = (await multiplayerView(s, actor)).game;
  if (shown === null) return false;
  const held = await s.harness.serverSql.sqlClient.query(sql<{
    revision: number;
    setup_ready: string | null;
  }>`SELECT revision, setup_ready FROM chess_multiplayer_games
    WHERE id = ${shown.id} AND deleted_at IS NULL`);
  const game = held[0];
  return (
    game !== undefined &&
    Number(game.revision) === shown.revision &&
    (game.setup_ready ?? '') === (shown.setup_ready ?? '')
  );
}

/**
 * The person's own rating at one speed (`blitz`) of the game whose time
 * controls are in `clockNamespace`, or `null` before they have one.
 */
export async function multiplayerRatingAt(
  s: ProductHarness,
  actor: string,
  namespace: string,
  speed: ClockSpeed
): Promise<MultiplayerRatingView | null> {
  const wanted = gameSpeed(namespace, speed);
  return (
    (await multiplayerView(s, actor)).ratings.find(
      (rating) => rating.speed === wanted
    ) ?? null
  );
}

/** One observed moment across devices, without a report frame per SQL read. */
export async function multiplayerDeviceViews(
  s: ProductHarness,
  actors: readonly string[]
) {
  const views = new Map<string, Awaited<ReturnType<typeof multiplayerView>>>();
  for (const actor of actors) views.set(actor, await multiplayerView(s, actor));
  return views;
}

export async function multiplayerText(
  s: ProductHarness,
  actor: string,
  target: string
): Promise<string | null> {
  const ui = await actorUi(s, actor);
  return (await ui.get(target).isVisible())
    ? await ui.get(target).text()
    : null;
}

/**
 * The text a person sees on their multiplayer screen, brought to the front.
 * A control kept on another place of finding an opponent (the ratings, the
 * game's commands, the game record) is read there: the place is opened as a
 * person opens it, and left again.
 */
export async function shownMultiplayerText(
  s: ProductHarness,
  actor: string,
  target: string
): Promise<string | null> {
  await bringToFront(s, actor);
  return onMultiplayerPlace(s, actor, multiplayerPlaceHolding(target), () =>
    multiplayerText(s, actor, target)
  );
}

/** Seconds shown on one rendered multiplayer clock (`m:ss`). */
export async function shownMultiplayerClock(
  s: ProductHarness,
  actor: string,
  side: 'white' | 'black'
): Promise<number | null> {
  const text = await shownMultiplayerText(
    s,
    actor,
    `multiplayer-${side}-clock`
  );
  const parts = /^(\d+):(\d{2})$/.exec(text?.trim() ?? '');
  if (parts === null) return null;
  return Number(parts[1]) * 60 + Number(parts[2]);
}

/** Whole days shown on one rendered daily multiplayer clock (`3d`). */
export async function shownMultiplayerClockDays(
  s: ProductHarness,
  actor: string,
  side: 'white' | 'black'
): Promise<number | null> {
  const text = await shownMultiplayerText(
    s,
    actor,
    `multiplayer-${side}-clock`
  );
  const parts = /^(\d+)d$/.exec(text?.trim() ?? '');
  return parts === null ? null : Number(parts[1]);
}

/** How many people are waiting for an opponent, for any game. */
export async function waitingSearchCount(s: ProductHarness): Promise<number> {
  const rows = await s.harness.serverSql.sqlClient.query(sql<{
    readonly waiting: number | string;
  }>`SELECT COUNT(*) AS waiting FROM chess_opponent_searches
    WHERE standing = 'waiting' AND deleted_at IS NULL`);
  return Number(rows[0]?.waiting ?? 0);
}

export async function storedMultiplayerSnapshot(s: ProductHarness) {
  return s.harness.serverSql.sqlClient.transaction(async (tx) => ({
    games: await tx.query(sql<
      MultiplayerGame & { match_id: string }
    >`SELECT g.match_id, ${GAME_COLUMNS}
      FROM chess_multiplayer_games AS g WHERE g.deleted_at IS NULL ORDER BY g.id`),
    current: await tx.query(sql<{ owner_id: string; game_id: string }>`
      SELECT owner_id, game_id FROM chess_multiplayer_players
      WHERE deleted_at IS NULL AND owner_id IS NOT NULL AND game_id IS NOT NULL ORDER BY owner_id`),
  }));
}

/** How many moves the person's move list shows, brought to the front. */
export async function shownMoveCount(
  s: ProductHarness,
  actor: string
): Promise<number> {
  await bringToFront(s, actor);
  const ui = await actorUi(s, actor);
  // A result lists no moves: they are one row away, and read there.
  const opened = await showMultiplayerMoveList(s, actor);
  let shown = 0;
  while (await ui.get(`multiplayer-move-${String(shown + 1)}`).isVisible())
    shown++;
  if (opened) await returnToMultiplayerHome(s, actor);
  return shown;
}
