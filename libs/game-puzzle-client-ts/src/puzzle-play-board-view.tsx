import { useLingui } from '@lingui/solid/macro';
import type { SpaceGameAction } from '@pkgs/ui-root-client-ts/space-types';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { PuzzleBoardFrame } from './puzzle-board-frame';
import { usePuzzleSolveActions } from './puzzle-in-game-play';
import { PuzzleLineMoves, usePuzzleLineActions } from './puzzle-play-line-view';
import {
  PuzzleResultRows,
  PuzzleResultSummary,
  usePuzzlePlayResult,
} from './puzzle-play-result-view';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleSolveLine, SpectatorAllowance } from './puzzle-play-solve-view';

/**
 * The feed's three places with the board, on one frame so the board is the
 * same from one to the next: a puzzle's last move is still played (and
 * heard) as its result arrives, and opening the line never redraws it.
 *
 * - `play`: solve the puzzle. What the solve state allows on the action
 *   bar, the line so far and the one row to the puzzle settings; a watcher
 *   gets the board, the status line and the line only.
 * - `line`: step through the moves played. The board takes no move here.
 * - `result`: how the finished puzzle went in the status line, the rating
 *   it made, rows on to the line and the puzzle settings, and what next on
 *   the action bar.
 */
export function PuzzlePlayBoardView(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  const place = (): string => props.place.screen;
  const solve = usePuzzleSolveActions(() => props);
  const line = usePuzzleLineActions(() => props);
  const result = usePuzzlePlayResult(() => props);
  const actions = (): readonly SpaceGameAction[] => {
    if (place() === 'line') return line();
    return props.spectator ? [] : solve();
  };
  return (
    <PuzzleBoardFrame
      view={props}
      lead={
        <Show when={props.spectator}>
          <SpectatorAllowance label={props.allowanceLabel} />
        </Show>
      }
      actions={actions()}
      waiting={props.spectator ? t`Watching the host solve` : undefined}
      result={place() === 'result' ? result() : undefined}
      body={
        <Switch>
          <Match when={place() === 'play'}>
            <PuzzleSolveLine {...props} />
          </Match>
          <Match when={place() === 'line'}>
            <PuzzleLineMoves {...props} />
          </Match>
          <Match when={place() === 'result'}>
            <PuzzleResultSummary {...props} />
            <PuzzleResultRows {...props} />
          </Match>
        </Switch>
      }
    />
  );
}
