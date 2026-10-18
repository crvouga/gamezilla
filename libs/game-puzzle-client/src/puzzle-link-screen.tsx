/**
 * What a puzzle link opens to: the puzzle on the person's board in their
 * space, or why not — puzzles need a connection, the puzzle is no longer
 * available, or the person cannot open another space.
 */

import { puzzleNamespaceOf } from '@libs/game-puzzle-shared/puzzle-namespace';
import { DenialSurface } from '@libs/permissions-client/denial-surface';
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import type { TurnGames } from '@pkgs/turn-game-shared/game-rules';
import { useLocalSearchParams } from '@pkgs/ui-root-client/app-router';
import { ContentScreen } from '@pkgs/ui-root-client/content-screen';
import { EmptyState } from '@pkgs/ui-root-client/empty-state';
import { SearchIcon, WifiOffIcon } from '@pkgs/ui-root-client/icons';
import { LoadingState } from '@pkgs/ui-root-client/loading-state';
import { createMemo, type JSX, Match, Show, Switch, untrack } from 'solid-js';
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
  const puzzleId = () => params().puzzleId ?? '';
  const gameId = createMemo(() => gameOfPuzzle(props.turnGames, puzzleId()));
  return (
    <ContentScreen
      screenId="chess-puzzle-link"
      breadcrumbs={[{ name: <Trans>Puzzle</Trans> }]}
      dataSet={{ testid: Handles.chessPuzzleLinkScreen }}
    >
      <Show
        when={gameId()}
        keyed
        fallback={<PuzzleLinkOutcome opening={() => UNAVAILABLE} />}
      >
        {(id) => <PuzzleLinkOpener puzzleId={puzzleId} gameId={id} />}
      </Show>
    </ContentScreen>
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

/** Opening the link, or why it cannot open. */
function PuzzleLinkOutcome(props: {
  readonly opening: () => PuzzleLinkOpening;
}): JSX.Element {
  const opening = () => props.opening();
  return (
    <Switch fallback={<LoadingState />}>
      <Match when={opening().kind === 'offline'}>
        <EmptyState
          icon={WifiOffIcon}
          title={<Trans>You're offline</Trans>}
          body={
            <Trans>
              Puzzles need a connection. Reconnect and open the puzzle link
              again.
            </Trans>
          }
          dataSet={{ testid: Handles.chessPuzzleOffline }}
        />
      </Match>
      <Match when={opening().kind === 'unavailable'}>
        <EmptyState
          icon={SearchIcon}
          title={<Trans>This puzzle is no longer available</Trans>}
          body={
            <Trans>
              It was taken out of the puzzles, so its link no longer opens it.
            </Trans>
          }
          dataSet={{ testid: Handles.chessPuzzleLinkUnavailable }}
        />
      </Match>
      <Match
        when={(() => {
          const current = opening();
          return current.kind === 'spaceLimited' ? current : null;
        })()}
        keyed
      >
        {(limited) => <DenialSurface decision={limited.decision} />}
      </Match>
    </Switch>
  );
}
