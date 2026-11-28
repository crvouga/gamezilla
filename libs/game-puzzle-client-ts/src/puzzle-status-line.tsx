import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { SpeakingAvatar } from '@pkgs/ui-root-client-ts/speaking-avatar';
import { SpectatorIndicator } from '@pkgs/ui-root-client-ts/spectator-indicator';
import { useLayoutMode } from '@pkgs/ui-root-client-ts/use-layout-mode';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { PuzzleClockLabel } from './puzzle-clock-label';
import type { PuzzleStageScreenViewProps } from './puzzle-play-screen-model';
import { PuzzleStatusHeader } from './puzzle-status-header';

function formatSignedDelta(delta: number): string {
  return delta > 0 ? `+${delta}` : String(delta);
}

/**
 * What ends the status line: what the attempt did to the rating once that
 * is decided (a wrong move already has), or that it cannot move it (a
 * repeat, §9); then the clock, and the mark of someone watching.
 */
function StatusLineTrailing(props: PuzzleStageScreenViewProps): JSX.Element {
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
  props: PuzzleStageScreenViewProps
): JSX.Element {
  const handles = () => props.coach.handles;
  // On a phone the coach sits over the board: its bubble keeps one height
  // whatever it says, so the board under it never moves.
  const mode = useLayoutMode();
  const compact = (): boolean => mode() === 'compact';
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
          retryOpen={props.status === 'wrong'}
          solvedLate={
            props.status === 'solved' &&
            props.result.completion?.outcome === 'failed'
          }
          trailing={<StatusLineTrailing {...props} />}
        />
      }
      numberOfLines={compact() ? 1 : 2}
      fixedHeight={compact()}
    />
  );
}
