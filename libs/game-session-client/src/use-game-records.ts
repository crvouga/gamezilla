import { useMyId } from '@libs/auth-client/use-current-user';
import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import {
  CustomGameSetupsAttr,
  ownCustomGameSetup,
} from '@libs/game-session-shared/custom-game-setup';
import {
  type CustomGames,
  CustomGamesAttr,
} from '@libs/game-session-shared/custom-game-state';
import { useSpaceRoomSelector } from '@libs/spaces-client/use-space-room-selector';
import sql from '@pkgs/sql-root-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { useTurnGames } from '@pkgs/turn-game-client/turn-games-context';
import type {
  GameRules,
  RecordedMove,
} from '@pkgs/turn-game-shared/game-rules';
import { createMemo } from 'solid-js';
export type GameHistoryRecord = {
  readonly id: string;
  readonly position: string;
  readonly first: string;
  readonly second: string;
  readonly firstBot: boolean;
  readonly secondBot: boolean;
  readonly outcome: string;
  readonly reason: string;
  readonly moves: readonly RecordedMove[];
  /** The viewer's own private setup in the game, when it has one; never another's. */
  readonly setup: string | null;
};
export function useGameRecords(gameId: () => string) {
  const myId = useMyId();
  const rules = useTurnGames();
  const local = useSpaceRoomSelector(CustomGamesAttr.from);
  const localSetups = useSpaceRoomSelector(CustomGameSetupsAttr.from);
  // Only the person's own setups ever reach this device.
  const ownSetups = createQuery(
    () => sql<{
      game_id: string;
      setup: string;
    }>`SELECT game_id, setup FROM chess_multiplayer_setups
    WHERE owner_id = ${myId()} AND deleted_at IS NULL`
  );
  const matches = createQuery(
    () => sql<MultiplayerGame>`SELECT * FROM chess_multiplayer_games
    WHERE (white_id = ${myId()} OR black_id = ${myId()}) AND deleted_at IS NULL
    ORDER BY created_at DESC LIMIT 100`
  );
  const records = createMemo(() => {
    const gameRules = rules.byId(gameId());
    const owned = customRecords(local(), {
      setups: localSetups(),
      gameRules,
      myId: myId(),
    });
    const remote = matches
      .rows()
      .filter((g) => gameRules.recognizes(g.fen) && g.outcome !== 'ongoing')
      .map((g) => ({
        id: g.id,
        position: g.fen,
        first: g.white_id,
        second: g.black_id,
        firstBot: false,
        secondBot: false,
        outcome: g.outcome,
        reason: g.reason ?? '',
        moves: gameRules.moves(g.fen, g.pgn, []),
        setup:
          ownSetups.rows().find((row) => row.game_id === g.id)?.setup ?? null,
      }));
    return [
      ...owned.reverse(),
      ...remote,
    ] satisfies readonly GameHistoryRecord[];
  });
  const statistics = createMemo(() => countResults(records(), myId()));
  return { records, statistics, isLoading: matches.isLoading };
}

/** The space's finished custom games of the game, each with the viewer's own setup. */
function customRecords(
  custom: CustomGames,
  context: {
    readonly setups: ReturnType<typeof CustomGameSetupsAttr.from>;
    readonly gameRules: GameRules;
    readonly myId: string;
  }
): GameHistoryRecord[] {
  return [
    ...custom.history,
    ...(custom.current === null ? [] : [custom.current]),
  ]
    .filter(
      (g) =>
        context.gameRules.recognizes(g.fen) &&
        (g.status === 'completed' || g.status === 'cancelled')
    )
    .map((g) => ({
      id: g.id,
      position: g.fen,
      first: g.white.person,
      second: g.black.person,
      firstBot: g.white.kind === 'bot',
      secondBot: g.black.kind === 'bot',
      outcome:
        g.outcome === 'draw'
          ? 'draw'
          : g.status === 'cancelled'
            ? 'aborted'
            : g.outcome.startsWith('white')
              ? 'white'
              : 'black',
      reason: g.outcome,
      moves: context.gameRules.moves(
        g.fen,
        '',
        g.moves.map((move) => move.uci)
      ),
      setup: ownCustomGameSetup(
        CustomGameSetupsAttr(context.setups),
        g,
        context.myId
      ),
    }));
}

function countResults(records: readonly GameHistoryRecord[], myId: string) {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  for (const game of records) {
    const side =
      game.first === myId ? 'white' : game.second === myId ? 'black' : null;
    if (side === null || game.outcome === 'aborted') continue;
    if (game.outcome === 'draw') draws++;
    else if (game.outcome === side) wins++;
    else losses++;
  }
  return { wins, losses, draws };
}
