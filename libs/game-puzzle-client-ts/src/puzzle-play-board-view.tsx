import { type JSX, Match, Show, Switch } from 'solid-js';
import { PuzzleBoardFrame } from './puzzle-board-frame';
import { PuzzleLineActions, PuzzleLineMoves } from './puzzle-play-line-view';
import {
  PuzzleResultRows,
  PuzzleResultSummary,
} from './puzzle-play-result-view';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import {
  PuzzleSolveActions,
  PuzzleSolveLine,
  SpectatorAllowance,
} from './puzzle-play-solve-view';

/**
 * The feed's three places with the board, on one frame so the board is the
 * same from one to the next: a puzzle's last move is still played (and
 * heard) as its result arrives, and opening the line never redraws it.
 *
 * - `play`: solve the puzzle. What the solve state allows, the line so far
 *   and the one row to the puzzle settings; a watcher gets the board, the
 *   status line and the line only.
 * - `line`: step through the moves played. The board takes no move here.
 * - `result`: how the finished puzzle went, the rating it made and what
 *   next, with rows on to the line and the puzzle settings.
 */
export function PuzzlePlayBoardView(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  const place = (): string => props.place.screen;
  return (
    <PuzzleBoardFrame
      screenId={`chess-puzzle-${place()}`}
      view={props}
      lead={
        <Show when={props.spectator}>
          <SpectatorAllowance label={props.allowanceLabel} />
        </Show>
      }
      actions={
        <Switch>
          <Match when={place() === 'play' && !props.spectator}>
            <PuzzleSolveActions {...props} />
          </Match>
          <Match when={place() === 'line'}>
            <PuzzleLineActions {...props} />
          </Match>
          <Match when={place() === 'result'}>
            <PuzzleResultSummary {...props} />
          </Match>
        </Switch>
      }
      timeline={
        <Switch>
          <Match when={place() === 'play'}>
            <PuzzleSolveLine {...props} />
          </Match>
          <Match when={place() === 'line'}>
            <PuzzleLineMoves {...props} />
          </Match>
          <Match when={place() === 'result'}>
            <PuzzleResultRows {...props} />
          </Match>
        </Switch>
      }
    />
  );
}
