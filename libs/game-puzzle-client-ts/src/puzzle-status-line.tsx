import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { PuzzleScreenFold } from '@pkgs/ui-root-client-ts/puzzle-screen';
import { SpeakingAvatar } from '@pkgs/ui-root-client-ts/speaking-avatar';
import { type JSX, Show } from 'solid-js';
import { PuzzleClockLabel } from './puzzle-clock-label';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleStatusHeader } from './puzzle-status-header';

/** The coach's face: small, so its words keep the line beside the board. */
const AVATAR_SIZE = 40;

function formatSignedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

/**
 * What ends the status line: what the attempt did to the rating once that
 * is decided (a wrong move already has), or that it cannot move it (a
 * repeat, §9); then the clock. Someone watching is marked over the line
 * (`SpectatorAllowance`), so the turn pill keeps its whole label.
 */
export function StatusLineTrailing(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  // A finished puzzle's rated summary says the change itself.
  const change = (): number | null =>
    typeof props.ratingChange === 'number' &&
    !(props.place.screen === 'result' && props.result.completion !== null)
      ? props.ratingChange
      : null;
  return (
    <>
      <Show when={change()} keyed>
        {(delta) => (
          <Badge
            intent="neutral"
            label={formatSignedDelta(delta)}
            dataSet={{ testid: 'chess-puzzle-feed-rating-change' }}
          />
        )}
      </Show>
      <Show when={props.ratingChange === 'unrated'}>
        <Badge
          intent="neutral"
          label={<Trans>Unrated</Trans>}
          dataSet={{ testid: 'chess-puzzle-feed-unrated-label' }}
        />
      </Show>
      <PuzzleClockLabel elapsedMs={props.elapsedMs} />
    </>
  );
}

/**
 * The board's one status line: whose move it is or how the attempt stands,
 * the coach's words about it under that, and the clock at its end.
 */
export function PuzzleStatusLine(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  const handles = () => props.coach.handles;
  return (
    // A short phone's result says the coach's words in its card, which
    // the dock holds in view; the bubble folds away there (never redrawn,
    // so it is not said twice).
    <PuzzleScreenFold on={props.place.screen === 'result' ? 'tall' : 'always'}>
      <SpeakingAvatar
        message={props.coach.message}
        contextKey={props.coach.contextKey}
        bubbleResolving={props.coachResolving}
        speaker={props.speaker}
        dataSet={handles() ? { testid: 'puzzle-assistant' } : undefined}
        data-observation={handles()?.observation}
        data-purpose={handles()?.purpose}
        data-puzzle={handles()?.puzzleId}
        // A finished puzzle's card headlines it and carries these facts, so
        // the coach's bubble on the result is its words alone.
        header={
          props.place.screen === 'result' ? undefined : (
            <PuzzleStatusHeader
              kind={props.statusKind}
              solutionShown={props.status === 'revealed'}
              flawed={props.result.completion?.outcome === 'failed'}
              solverSide={props.solverSide ?? null}
              correct={props.correct}
              trailing={<StatusLineTrailing {...props} />}
            />
          )
        }
        numberOfLines={2}
        // A long explanation shows three lines and More, so on a short phone
        // the board, the coach and the dock still share the first view.
        clampLines={3}
        avatarSize={AVATAR_SIZE}
      />
    </PuzzleScreenFold>
  );
}
