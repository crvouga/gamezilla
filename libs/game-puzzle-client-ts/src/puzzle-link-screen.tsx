/**
 * What a puzzle link opens to: the puzzle on the person's board in their
 * space, or why not — puzzles need a connection, the puzzle is no longer
 * available, or the person cannot open another space.
 */

import { puzzleIdOfRouteParam } from '@libs/game-puzzle-shared-ts/puzzle-link';
import { puzzleNamespaceOf } from '@libs/game-puzzle-shared-ts/puzzle-namespace';
import type { TurnGames } from '@pkgs/turn-game-shared-ts/game-rules';
import { useLocalSearchParams } from '@pkgs/ui-root-client-ts/app-router';
import { createMemo, type JSX, Show, untrack } from 'solid-js';
import {
  PuzzleLinkScreenView,
  type PuzzleLinkStatus,
} from './puzzle-link-screen-view';
import { useDeniedView } from './use-denied-view';
import type { PuzzleLinkOpening } from './use-puzzle-link-opening';
import { usePuzzleLinkOpening } from './use-puzzle-link-opening';

/** The registered game whose puzzles are in the namespace of `puzzleId`. */
function gameOfPuzzle(turnGames: TurnGames, puzzleId: string): string | null {
  const namespace = puzzleNamespaceOf(puzzleId);
  return (
    turnGames.games.find(
      (game) => game.capabilities.puzzles?.namespace === namespace
    )?.rules.id ?? null
  );
}

const UNAVAILABLE: PuzzleLinkOpening = { kind: 'unavailable' };

export function PuzzleLinkScreen(props: {
  readonly turnGames: TurnGames;
}): JSX.Element {
  const params = useLocalSearchParams<{ puzzleId?: string | undefined }>();
  const puzzleId = () => puzzleIdOfRouteParam(params().puzzleId ?? '');
  const gameId = createMemo(() => gameOfPuzzle(props.turnGames, puzzleId()));
  return (
    <Show
      when={gameId()}
      keyed
      fallback={<PuzzleLinkOutcome opening={() => UNAVAILABLE} />}
    >
      {(id) => <PuzzleLinkOpener puzzleId={puzzleId} gameId={id} />}
    </Show>
  );
}

/** Opens the link's puzzle in the game it is from. */
function PuzzleLinkOpener(props: {
  readonly puzzleId: () => string;
  readonly gameId: string;
}): JSX.Element {
  // The game of a link is fixed while it shows: read once.
  const opening = usePuzzleLinkOpening(
    props.puzzleId,
    untrack(() => props.gameId)
  );
  return <PuzzleLinkOutcome opening={opening} />;
}

/** The view's status; a denial carries its own copy. */
function linkStatus(opening: PuzzleLinkOpening): PuzzleLinkStatus {
  return opening.kind === 'spaceLimited' ? 'opening' : opening.kind;
}

/** Opening the link, or why it cannot open. */
function PuzzleLinkOutcome(props: {
  readonly opening: () => PuzzleLinkOpening;
}): JSX.Element {
  const opening = () => props.opening();
  const denial = useDeniedView({
    get decision() {
      const current = opening();
      return current.kind === 'spaceLimited' ? current.decision : null;
    },
  });
  return (
    <PuzzleLinkScreenView status={linkStatus(opening())} denial={denial()} />
  );
}
