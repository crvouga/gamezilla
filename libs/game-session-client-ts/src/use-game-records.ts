import { useMyId } from '@libs/auth-client-ts/use-current-user';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared-ts/game-state';
import {
  multiplayerOwner,
  multiplayerSides,
} from '@libs/game-matchmaking-shared-ts/multiplayer-roster';
import {
  GameSessionHandsAttr,
  ownGameSessionHand,
} from '@libs/game-session-shared-ts/game-session-hands';
import { gameSessionWinners } from '@libs/game-session-shared-ts/game-session-outcome';
import {
  GameSessionSetupsAttr,
  ownGameSessionSetup,
} from '@libs/game-session-shared-ts/game-session-setup';
import {
  type GameSession,
  type GameSessions,
  GameSessionsAttr,
} from '@libs/game-session-shared-ts/game-session-state';
import { useSpaceRoomSelector } from '@libs/spaces-client-ts/use-space-room-selector';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import type {
  GamePositionRules,
  GameSide,
  RecordedMove,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { isTurnRules } from '@pkgs/turn-game-shared-ts/game-rules';
import { createMemo } from 'solid-js';
export type GameHistoryRecord = {
  readonly id: string;
  readonly position: string;
  readonly participants: readonly {
    readonly side: GameSide;
    readonly person: string;
    readonly bot: boolean;
    readonly local: boolean;
  }[];
  /** Won (by one side or jointly), drawn or cancelled. */
  readonly result: 'won' | 'draw' | 'aborted';
  /** The sides the result went to: every side for a draw, none when cancelled. */
  readonly winners: readonly GameSide[];
  readonly reason: string;
  readonly moves: readonly RecordedMove[];
  /** The viewer's own private setup in the game, when it has one; never another's. */
  readonly setup: string | null;
  /** The viewer's own last hand in the game, when it deals hands; never another's. */
  readonly hand: string | null;
  /** When the game ended, as an ISO instant; `null` when unknown. */
  readonly endedAt: string | null;
  /** Found by matchmaking, rather than set up in the space. */
  readonly matched: boolean;
};

/** A matched game's row with the time it last changed: when it ended, once it has. */
type FinishedMatch = MultiplayerGame & { readonly updated_at?: string | null };
export function useGameRecords(gameId: () => string) {
  const myId = useMyId();
  const rules = useTurnGames();
  const local = useSpaceRoomSelector(GameSessionsAttr.from);
  const localSetups = useSpaceRoomSelector(GameSessionSetupsAttr.from);
  const localHands = useSpaceRoomSelector(GameSessionHandsAttr.from);
  // Only the person's own setups ever reach this device.
  const ownSetups = createQuery(
    () => sql<{
      game_id: string;
      setup: string;
    }>`SELECT game_id, setup FROM chess_multiplayer_setups
    WHERE owner_id = ${myId()} AND deleted_at IS NULL`
  );
  // And only their own dealt hands.
  const ownHands = createQuery(
    () => sql<{
      game_id: string;
      hand: string;
    }>`SELECT game_id, hand FROM chess_multiplayer_hands
    WHERE owner_id = ${myId()} AND deleted_at IS NULL`
  );
  const matches = createQuery(
    () => sql<FinishedMatch>`SELECT * FROM chess_multiplayer_games
    WHERE (white_id = ${myId()} OR black_id = ${myId()} OR red_id = ${myId()} OR blue_id = ${myId()}) AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 100`
  );
  const records = createMemo(() => {
    const gameRules = rules.byId(gameId());
    const owned = customRecords(local(), {
      setups: localSetups(),
      hands: localHands(),
      gameRules,
      myId: myId(),
    });
    const remote = matches
      .rows()
      .filter((g) => gameRules.recognizes(g.fen) && g.outcome !== 'ongoing')
      .map((g) => ({
        id: g.id,
        position: g.fen,
        participants: multiplayerSides(g).map((side) => ({
          side,
          person: multiplayerOwner(g, side),
          bot: false,
          local: false,
        })),
        ...matchedResult(g),
        reason: g.reason ?? '',
        moves: isTurnRules(gameRules) ? gameRules.moves(g.fen, g.pgn, []) : [],
        setup:
          ownSetups.rows().find((row) => row.game_id === g.id)?.setup ?? null,
        hand: ownHands.rows().find((row) => row.game_id === g.id)?.hand ?? null,
        endedAt: g.updated_at ?? null,
        matched: true,
      }));
    return [
      ...owned.reverse(),
      ...remote,
    ] satisfies readonly GameHistoryRecord[];
  });
  const statistics = createMemo(() => countResults(records(), myId()));
  return { records, statistics, isLoading: matches.isLoading };
}

/** The space's finished game sessions of the game, each with the viewer's own setup. */
function customRecords(
  sessions: GameSessions,
  context: {
    readonly setups: ReturnType<typeof GameSessionSetupsAttr.from>;
    readonly hands: ReturnType<typeof GameSessionHandsAttr.from>;
    readonly gameRules: GamePositionRules;
    readonly myId: string;
  }
): GameHistoryRecord[] {
  return [
    ...sessions.history,
    ...(sessions.current === null ? [] : [sessions.current]),
  ]
    .filter(
      (g) =>
        context.gameRules.recognizes(g.fen) &&
        (g.status === 'completed' || g.status === 'cancelled')
    )
    .map((g) => ({
      id: g.id,
      position: g.fen,
      participants: g.sides.map((side) => ({
        side,
        person: g[side].person,
        bot: g[side].kind === 'bot',
        local: g[side].kind === 'local',
      })),
      ...customResult(g),
      reason: g.outcomeReason || g.outcome,
      moves: isTurnRules(context.gameRules)
        ? context.gameRules.moves(
            g.fen,
            '',
            g.moves.map((move) => move.uci)
          )
        : [],
      setup: ownGameSessionSetup(
        GameSessionSetupsAttr(context.setups),
        g,
        context.myId
      ),
      hand: ownGameSessionHand(
        GameSessionHandsAttr(context.hands),
        g,
        context.myId
      ),
      endedAt: g.endedAt === null ? null : new Date(g.endedAt).toISOString(),
      matched: false,
    }));
}

function customResult(
  game: GameSession
): Pick<GameHistoryRecord, 'result' | 'winners'> {
  if (game.status === 'cancelled') return { result: 'aborted', winners: [] };
  const winners = gameSessionWinners(game);
  // An outcome naming no side reads as a draw, as it always has.
  return game.outcome === 'draw' || winners.length === 0
    ? { result: 'draw', winners: game.sides }
    : { result: 'won', winners };
}

function matchedResult(
  game: MultiplayerGame
): Pick<GameHistoryRecord, 'result' | 'winners'> {
  if (game.outcome === 'aborted') return { result: 'aborted', winners: [] };
  if (game.outcome === 'draw')
    return { result: 'draw', winners: multiplayerSides(game) };
  return game.outcome === 'ongoing'
    ? { result: 'aborted', winners: [] }
    : { result: 'won', winners: [game.outcome] };
}

/** A person wins when the result goes to their side, alone or jointly. */
function countResults(records: readonly GameHistoryRecord[], myId: string) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const game of records) {
    const side =
      game.participants.find((participant) => participant.person === myId)
        ?.side ?? null;
    if (side === null || game.result === 'aborted') continue;
    if (game.result === 'draw') draws++;
    else if (game.winners.includes(side)) wins++;
    else losses++;
  }
  return { wins, losses, draws };
}
