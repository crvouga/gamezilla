import type { MultiplayerGame } from '@libs/game-matchmaking-shared/game-state';
import { useTurnGames } from '@pkgs/turn-game-client/turn-games-context';
import { type Accessor, createMemo, createSignal } from 'solid-js';
import type { MultiplayerMove } from './multiplayer-format';
import { multiplayerMoves, positionAfter } from './multiplayer-format';
import { FLIPPED_GAME, useGameMark } from './use-game-mark';

/** The earlier position a person is reviewing on their own board. */
export type EarlierPosition = {
  /** Moves played to reach it: none at the start of the game. */
  readonly ply: number;
  /** The move that led to it; null at the start of the game. */
  readonly move: MultiplayerMove | null;
  readonly fen: string;
};

/** Which side this device sees the board from. */
function useFlip(game: Accessor<MultiplayerGame | null>) {
  const flips = useGameMark(FLIPPED_GAME);
  const flipped = (): boolean => {
    const current = game();
    return current !== null && flips.marks(current.id);
  };
  return {
    flipped,
    flip: (): void => {
      const current = game();
      if (current !== null) flips.mark(current.id, !flipped());
    },
  };
}

/**
 * Which position of the game this device shows. The person chooses an
 * earlier position by how many moves led to it; it stays chosen while moves
 * are accepted meanwhile, and only for the game it was chosen in.
 */
function useReview(game: Accessor<MultiplayerGame | null>) {
  const rules = useTurnGames();
  const moves = createMemo(() => {
    const current = game();
    return current === null ? [] : multiplayerMoves(current, rules);
  });
  const [chosen, setChosen] = createSignal<{
    readonly gameId: string;
    readonly ply: number;
  } | null>(null);
  const earlier = createMemo((): EarlierPosition | null => {
    const at = chosen();
    if (at === null || at.gameId !== game()?.id) return null;
    const fen = positionAfter(moves(), at.ply);
    if (fen === null || at.ply >= moves().length) return null;
    return { ply: at.ply, move: moves()[at.ply - 1] ?? null, fen };
  });
  const shownPly = (): number => earlier()?.ply ?? moves().length;
  /** The position after the latest move is the current position. */
  const show = (ply: number): void => {
    const current = game();
    const reviewing =
      current !== null && ply >= 0 && ply < moves().length
        ? { gameId: current.id, ply }
        : null;
    setChosen(reviewing);
  };
  return {
    moves,
    earlier,
    shownPly,
    chooseMove: show,
    stepBack: (): void => {
      if (shownPly() > 0) show(shownPly() - 1);
    },
    stepForward: (): void => {
      const at = earlier();
      if (at !== null) show(at.ply + 1);
    },
    goToStart: (): void => show(0),
    returnToCurrent: (): void => show(moves().length),
  };
}

/**
 * How this device shows the multiplayer board: which side it is seen from,
 * and which position of the game is on it. Both belong to the device and
 * the game: nothing here is ever sent, it needs no connection, and a new
 * game or a rematch starts afresh.
 */
export function useOwnBoard(game: Accessor<MultiplayerGame | null>) {
  return { ...useFlip(game), ...useReview(game) };
}

export type OwnBoard = ReturnType<typeof useOwnBoard>;
