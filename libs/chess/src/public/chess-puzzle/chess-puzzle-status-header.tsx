import { Trans } from '@lingui/solid/macro';
import { SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import {
  ChessPuzzleStatusIcon,
  type ChessPuzzleStatusKind,
} from './chess-puzzle-status-icons';

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

function sideToMoveLabel(sideToMove: 'white' | 'black'): JSX.Element {
  return sideToMove === 'white' ? (
    <Trans>White to move</Trans>
  ) : (
    <Trans>Black to move</Trans>
  );
}

export type ChessPuzzleStatusHeaderProps = {
  kind: ChessPuzzleStatusKind;
  /** Shown as a caption only while the attempt is being played. */
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
      <p class="text textBodyBold flex-1 text-text">
        {statusLabel(props.kind)}
      </p>
      <Show when={props.kind === 'started' ? props.sideToMove : null}>
        {(side) => (
          <p class="text textCaption shrink-0 text-text-secondary">
            {sideToMoveLabel(side())}
          </p>
        )}
      </Show>
      {props.trailing}
    </div>
  );
}
