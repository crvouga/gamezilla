import { Trans } from '@lingui/solid/macro';
import { SPEECH_BUBBLE_HEADER_EXTRA_HEIGHT } from '@pkgs/ui';
import type { JSX } from 'solid-js';

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
    case 'whiteToMove':
      return <Trans>White to move</Trans>;
    case 'blackToMove':
      return <Trans>Black to move</Trans>;
    case 'wrong':
      return <Trans>Wrong</Trans>;
    case 'solved':
      return <Trans>Solved</Trans>;
    default:
      return null;
  }
}

export type ChessPuzzleStatusHeaderProps = {
  kind: ChessPuzzleStatusKind;
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
    </div>
  );
}
