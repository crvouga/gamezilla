import type { PuzzleGame } from '@libs/game-puzzle-shared-ts/puzzle-setup';
import { defineContext } from '@pkgs/solid-context-client-ts/define-context';
import { useTurnGames } from '@pkgs/turn-game-client-ts/turn-games-context';
import { type JSX, untrack } from 'solid-js';
import type { GamePuzzlesClient } from './puzzle-client';

/** The game whose puzzles a surface shows: its rules, capability and client part. */
export type PuzzleGameScope = {
  readonly gameId: string;
  /** The game's share of the catalogue, profiles and feed settings. */
  readonly namespace: string;
  readonly game: PuzzleGame;
  readonly client: GamePuzzlesClient;
};

const PuzzleGameContext = defineContext<PuzzleGameScope>('PuzzleGame');

/**
 * Every puzzle screen of one game reads it: the registered game `gameId`,
 * which must offer puzzles, and the puzzles part of its client.
 */
export function PuzzleGameProvider(props: {
  readonly gameId: string;
  readonly client: GamePuzzlesClient;
  readonly children: JSX.Element;
}): JSX.Element {
  const turnGames = useTurnGames();
  // A game's registration is fixed for the app's lifetime: read once.
  const scope = untrack((): PuzzleGameScope => {
    const puzzles = turnGames.capability(props.gameId, 'puzzles');
    if (puzzles === undefined)
      throw new Error(`${props.gameId}: the game offers no puzzles`);
    const rules = turnGames.turnsForPosition(
      turnGames.byId(props.gameId).initial()
    );
    if (rules === undefined)
      throw new Error(`${props.gameId}: puzzles require turn rules`);
    return {
      gameId: props.gameId,
      namespace: puzzles.namespace,
      game: { rules, puzzles },
      client: props.client,
    };
  });
  return (
    <PuzzleGameContext.Provider value={scope}>
      {props.children}
    </PuzzleGameContext.Provider>
  );
}

/** The game whose puzzles the surface shows. */
export function usePuzzleGame(): PuzzleGameScope {
  return PuzzleGameContext.use();
}
