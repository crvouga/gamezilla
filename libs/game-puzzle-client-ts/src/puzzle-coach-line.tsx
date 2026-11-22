import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { SpeakingAvatar } from '@pkgs/ui-root-client-ts/speaking-avatar';
import { SpectatorIndicator } from '@pkgs/ui-root-client-ts/spectator-indicator';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import type { PuzzlePlayScreenViewProps } from './puzzle-play-screen-model';

/** The coach's face: small, so its words keep the line over the board. */
const AVATAR_SIZE = 40;

function formatSignedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

/**
 * What heads the coach's words: what the attempt did to the rating once
 * that is decided (a wrong move already has), or that it cannot move it (a
 * repeat, §9); then the mark of someone watching. Nothing when there is
 * neither.
 */
function CoachFacts(props: PuzzlePlayScreenViewProps): JSX.Element {
  // A finished puzzle's rated summary says the change itself.
  const change = (): number | null =>
    typeof props.ratingChange === 'number' &&
    !(props.place.screen === 'result' && props.result.completion !== null)
      ? props.ratingChange
      : null;
  return (
    <Show
      when={
        change() !== null || props.ratingChange === 'unrated' || props.spectator
      }
    >
      <StackHorizontal align="center" gap="sm" wrap>
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
        <Show when={props.spectator}>
          <SpectatorIndicator />
        </Show>
      </StackHorizontal>
    </Show>
  );
}

/**
 * The coach's words about the board, with what the attempt did to the
 * rating over them: the first thing in the stage, right under the status
 * line, so the two never repeat each other.
 */
export function PuzzleCoachLine(props: PuzzlePlayScreenViewProps): JSX.Element {
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
      header={<CoachFacts {...props} />}
      numberOfLines={2}
      avatarSize={AVATAR_SIZE}
    />
  );
}
