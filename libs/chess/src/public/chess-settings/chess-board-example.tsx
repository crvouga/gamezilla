import { ChessBoard } from '@pkgs/chess-board/chess-board';
import type { JSX } from 'solid-js';

const SAMPLE_FEN =
  'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4';

export default function ChessBoardExample(): JSX.Element {
  return (
    <div class="box gap-3 items-stretch w-[100%] max-w-[360px]">
      <p class="text textCaption text-text-secondary">
        {'Interactive Solid chess board.'}
      </p>
      <ChessBoard
        fen={SAMPLE_FEN}
        size={280}
        interactive
        showCoordinates
        highlightLastMove
      />
    </div>
  );
}
