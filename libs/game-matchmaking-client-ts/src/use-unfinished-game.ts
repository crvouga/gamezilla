import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import { multiplayerLinkRoute } from '@libs/game-matchmaking-shared-ts/multiplayer-link';
import {
  multiplayerOwner,
  multiplayerSides,
} from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import { isDailyTimeControl } from '@libs/game-matchmaking-shared-ts/time-control';
import { spaceDetailHref } from '@libs/spaces-client-ts/space-routes';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import {
  useGamePresentation,
  useTurnGames,
} from '@pkgs/turn-game-client-ts/turn-games-context';
import { type Accessor, createMemo } from 'solid-js';

export type DailyMatchPreview = {
  readonly game: string;
  readonly playerId: string;
  readonly myTurn: boolean;
  readonly lastMove: string | null;
  readonly figures: string | null;
};

/**
 * The person's unfinished game, wherever it is played: a custom game under
 * way that they sit in, or their unfinished matched game. A person has at
 * most one (`specs/games/unfinished-game-limit.dmn`).
 */
export type UnfinishedGame =
  | {
      readonly kind: 'custom';
      /** The space the custom game is played in. */
      readonly spaceId: string;
      /** Where returning to it leads. */
      readonly href: string;
    }
  | {
      readonly kind: 'matched';
      /** The game it is a game of. */
      readonly gameId: string;
      readonly daily: DailyMatchPreview | null;
      readonly href: string;
    };

type SeatRow = { readonly space_id: string };
type MatchedRow = Pick<
  MultiplayerGame,
  | 'fen'
  | 'pgn'
  | 'time_control'
  | 'turn'
  | 'white_id'
  | 'black_id'
  | 'red_id'
  | 'blue_id'
>;

/**
 * Read on every device of the person from what they hold: their seat in a
 * custom game under way (`chess_custom_game_seats`, kept from the space's
 * room) and their own matched game.
 */
export function useUnfinishedGame(): Accessor<UnfinishedGame | null> {
  const myId = useMyId();
  const rules = useTurnGames();
  const presentation = useGamePresentation();
  const seats = createQuery(
    () => sql<SeatRow>`
      SELECT c.space_id FROM chess_custom_game_seats AS c
      LEFT JOIN spaces AS s ON s.id = c.space_id
      WHERE c.owner_id = ${myId()} AND c.under_way = ${true}
        AND c.deleted_at IS NULL
        AND (s.id IS NULL OR (s.ended_at IS NULL AND s.deleted_at IS NULL))
      ORDER BY c.updated_at DESC
      LIMIT 1`
  );
  const matched = createQuery(
    () => sql<MatchedRow>`
      SELECT g.fen, g.pgn, g.time_control, g.turn, g.white_id, g.black_id, g.red_id, g.blue_id FROM chess_multiplayer_games AS g
      JOIN chess_multiplayer_players AS p ON p.game_id = g.id
      WHERE p.owner_id = ${myId()} AND p.deleted_at IS NULL
        AND g.deleted_at IS NULL AND g.outcome = ${'ongoing'}
      LIMIT 1`
  );
  function dailyPreview(game: MatchedRow): DailyMatchPreview | null {
    if (!isDailyTimeControl(game.time_control)) return null;
    const myTurn = game.turn === myId();
    const sides = multiplayerSides(game);
    const own = sides.find((side) => multiplayerOwner(game, side) === myId());
    const other =
      sides.length === 2 ? sides.find((side) => side !== own) : undefined;
    const view = presentation(game.fen);
    const mine = own && view.frame.seats.stat(game.fen, own);
    const theirs = other && view.frame.seats.stat(game.fen, other);
    const moves = rules
      .turnsForPosition(game.fen)
      ?.moves(game.fen, game.pgn, []);
    return {
      game: view.name(),
      playerId: other ? multiplayerOwner(game, other) : myTurn ? '' : game.turn,
      myTurn,
      lastMove: moves?.at(-1)?.label ?? null,
      figures:
        mine && theirs && mine.label === theirs.label
          ? `${mine.label} ${mine.value} – ${theirs.value}`
          : null,
    };
  }
  return createMemo((): UnfinishedGame | null => {
    if (myId().length === 0) return null;
    const seat = seats.rows()[0];
    if (seat !== undefined)
      return {
        kind: 'custom',
        spaceId: seat.space_id,
        href: spaceDetailHref(seat.space_id),
      };
    const game = matched.rows()[0];
    if (game === undefined) return null;
    const gameId = rules.forPosition(game.fen).id;

    return {
      kind: 'matched',
      gameId,
      daily: dailyPreview(game),
      href: multiplayerLinkRoute(gameId),
    };
  });
}
