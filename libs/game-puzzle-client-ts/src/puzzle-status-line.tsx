import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { SpeakingAvatar } from '@pkgs/ui-root-client-ts/speaking-avatar';
import { SpectatorIndicator } from '@pkgs/ui-root-client-ts/spectator-indicator';
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
 * repeat, §9); then the clock, and the mark of someone watching.
 */
function StatusLineTrailing(props: PuzzlePlayScreenViewProps): JSX.Element {
  const change = (): number | null =>
    typeof props.ratingChange === 'number' ? props.ratingChange : null;
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
      <Show when={props.spectator}>
        <SpectatorIndicator />
      </Show>
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
    <SpeakingAvatar
      message={props.coach.message}
      contextKey={props.coach.contextKey}
      bubbleResolving={props.coachResolving}
      speaker={props.speaker}
      dataSet={handles() ? { testid: 'puzzle-assistant' } : undefined}
      data-observation={handles()?.observation}
      data-purpose={handles()?.purpose}
      data-puzzle={handles()?.puzzleId}
      header={
        <PuzzleStatusHeader
          kind={props.statusKind}
          solutionShown={props.status === 'revealed'}
          solverSide={props.solverSide ?? null}
          correct={props.correct}
          trailing={<StatusLineTrailing {...props} />}
        />
      }
      numberOfLines={2}
      avatarSize={AVATAR_SIZE}
    />
  );
}
