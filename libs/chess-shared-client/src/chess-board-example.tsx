import { BOARD_THEME } from '@libs/chess-root-shared/board-theme';
import { Trans } from '@lingui/solid/macro';
import { ChessBoard } from '@pkgs/chess-board-root-client/chess-board';
import { useSoundsPreference } from '@pkgs/sounds-client/solid';
import { createMeasure } from '@pkgs/ui-root-client/measure';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import { P } from '@pkgs/ui-root-client/text';
import type { JSX } from 'solid-js';

const SAMPLE_FEN =
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

const MAX_BOARD_SIZE = 280;

export default function ChessBoardExample(): JSX.Element {
  const sounds = useSoundsPreference();
  const frame = createMeasure();
  // Until the frame is laid out the board keeps its largest size.
  const size = (): number =>
    frame.width() > 0
      ? Math.min(MAX_BOARD_SIZE, frame.width())
      : MAX_BOARD_SIZE;

  return (
    <StackVertical gap="md" width="full" measureTarget={frame.target}>
      <P variant="caption" tone="secondary">
        <Trans>Interactive Solid chess board.</Trans>
      </P>
      <ChessBoard
        theme={BOARD_THEME}
        sound={!sounds.muted()}
        fen={SAMPLE_FEN}
        size={size()}
        interactive
        showCoordinates
        highlightLastMove
      />
    </StackVertical>
  );
}
