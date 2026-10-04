import type { ChessPuzzleStatusKind } from '@libs/chess-puzzle-shared/status-kind';
import { Trans } from '@lingui/solid/macro';
import { SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT } from '@pkgs/ui-root-client/speech-bubble';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { ChessPuzzleStatusIcon } from './chess-puzzle-status-icons';

const HEADER_ROW_HEIGHT = SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT;

export { HEADER_ROW_HEIGHT };

function statusLabel(kind: ChessPuzzleStatusKind): JSX.Element | null {
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
function yourTurnLabel(side: 'white' | 'black'): JSX.Element {
  return side === 'white' ? (
    <Trans>Your turn — find the best move for White</Trans>
  ) : (
    <Trans>Your turn — find the best move for Black</Trans>
  );
}

export type ChessPuzzleStatusHeaderProps = {
  kind: ChessPuzzleStatusKind;
  /** The solver's side: the `started` label becomes the §5 "your turn" prompt. */
  sideToMove?: 'white' | 'black' | null;
  /** Right-aligned slot, e.g. the puzzle clock. */
  trailing?: JSX.Element;
};

export function ChessPuzzleStatusHeader(
  props: ChessPuzzleStatusHeaderProps
): JSX.Element {
  return (
    <div
      class="box flex-row items-center gap-2 self-stretch"
      style={{ height: `${HEADER_ROW_HEIGHT}px` }}
    >
      <ChessPuzzleStatusIcon kind={props.kind} />
      <p
        class="text textBodyBold flex-1 text-text line-clamp-2"
        data-testid="chess-puzzle-status-label"
      >
        <Show
          when={props.kind === 'started' ? props.sideToMove : null}
          fallback={statusLabel(props.kind)}
        >
          {(side) => yourTurnLabel(side())}
        </Show>
      </p>
      {props.trailing}
    </div>
  );
}
