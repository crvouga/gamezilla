import type { PuzzleStatusKind } from '@libs/game-puzzle-shared/status-kind';
import { Trans } from '@lingui/solid/macro';
import { SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT } from '@pkgs/ui-root-client/speech-bubble';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { PuzzleStatusIcon } from './puzzle-status-icons';

const HEADER_ROW_HEIGHT = SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT;

export { HEADER_ROW_HEIGHT };

function statusLabel(kind: PuzzleStatusKind): JSX.Element | null {
  switch (kind) {
    case 'loading':
      return <Trans>Loading puzzle…</Trans>;
    case 'empty':
      return <Trans>No puzzles left</Trans>;
    case 'offline':
      return <Trans>Offline</Trans>;
    case 'limited':
      return <Trans>Daily limit reached</Trans>;
    case 'waiting':
      return <Trans>Waiting for the host</Trans>;
    case 'started':
      return <Trans>Started</Trans>;
    case 'failed':
      return <Trans>Failed</Trans>;
    case 'skipped':
      return <Trans>Skipped</Trans>;
    case 'solved':
      return <Trans>Solved</Trans>;
    default:
      return null;
  }
}

/** §5 prompt once the setup move has played: the solver is to move. */
function yourTurnLabel(side: string): JSX.Element {
  return <Trans>Your turn — find the best move for {side}</Trans>;
}

export type PuzzleStatusHeaderProps = {
  kind: PuzzleStatusKind;
  /**
   * The solver's side, as the game names it: the `started` label becomes
   * the §5 "your turn" prompt.
   */
  solverSide?: string | null;
  /** Right-aligned slot, e.g. the puzzle clock. */
  trailing?: JSX.Element;
};

export function PuzzleStatusHeader(
  props: PuzzleStatusHeaderProps
): JSX.Element {
  return (
    <div
      class="box flex-row items-center gap-2 self-stretch mb-1"
      style={{ 'min-height': `${HEADER_ROW_HEIGHT}px` }}
    >
      <PuzzleStatusIcon kind={props.kind} />
      <p
        class="text textLabel flex-1 line-clamp-2"
        data-testid="chess-puzzle-status-label"
      >
        <Show
          when={props.kind === 'started' ? props.solverSide : null}
          fallback={statusLabel(props.kind)}
        >
          {(side) => yourTurnLabel(side())}
        </Show>
      </p>
      {props.trailing}
    </div>
  );
}
