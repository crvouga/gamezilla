import { LINKED_PUZZLE_PARAM } from '@libs/game-puzzle-shared/puzzle-link';
import { useGameScreen } from '@libs/spaces-client/use-game-screen';
import { useLocalSearchParams } from '@pkgs/ui-root-client/app-router';
import type { JSX } from 'solid-js';
import { createEffect, untrack } from 'solid-js';
import type { GamePuzzlesClient } from './puzzle-client';
import { PuzzleFeedProvider } from './puzzle-feed-provider';
import { PuzzleGameProvider } from './puzzle-game-context';
import { PUZZLE_SCREEN } from './puzzle-screens';
import { ReconcilePuzzleResult } from './reconcile-puzzle-result';
import { useIsPuzzleDriver } from './use-puzzle-space-role';

/** A space opened from a puzzle link goes straight to the puzzle. */
function LinkedPuzzle(): JSX.Element {
  const params = useLocalSearchParams<{ puzzle?: string | undefined }>();
  const isDriver = useIsPuzzleDriver();
  const gameScreen = useGameScreen();
  createEffect(() => {
    if (params()[LINKED_PUZZLE_PARAM] === undefined || !isDriver()) return;
    if (gameScreen.screen() === PUZZLE_SCREEN.puzzle) return;
    untrack(() => gameScreen.show(PUZZLE_SCREEN.puzzle));
  });
  return null;
}

/**
 * Every screen of a game offering puzzles reads the game's puzzle feed and
 * honours a puzzle link (the platform wraps the game's own frame in it).
 */
export function PuzzleFrame(props: {
  readonly gameId: string;
  readonly puzzles: GamePuzzlesClient;
  readonly children: JSX.Element;
}): JSX.Element {
  return (
    <PuzzleGameProvider gameId={props.gameId} client={props.puzzles}>
      <PuzzleFeedProvider>
        <LinkedPuzzle />
        {props.children}
      </PuzzleFeedProvider>
    </PuzzleGameProvider>
  );
}

/**
 * A result belongs to the account even while it views stats or settings:
 * mounted for the whole space session of a game offering puzzles.
 */
export function PuzzleSessionEffects(props: {
  readonly gameId: string;
  readonly puzzles: GamePuzzlesClient;
}): JSX.Element {
  return (
    <PuzzleGameProvider gameId={props.gameId} client={props.puzzles}>
      <ReconcilePuzzleResult />
    </PuzzleGameProvider>
  );
}
