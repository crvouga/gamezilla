import type { Move } from '../chess-board/chess-board-types';
import type { ChessPuzzlePlayStatus } from '../../shared/chess-puzzle-play';
import { usePuzzlePlayerEffects } from './use-puzzle-player-effects';
import { usePuzzlePlayerHandlers } from './use-puzzle-player-handlers';

export function usePuzzlePlayerControls(args: {
  solveIdx: number;
  status: ChessPuzzlePlayStatus | 'loading';
  displayFen: string | null;
  onMoveRaw: (m: Move) => void;
  setLastUci: (uci: string) => void;
  appendUsedHint: () => Promise<void>;
  appendAbandoned: () => Promise<void>;
  onRequestNext: () => void;
}) {
  const { solveIdx, status, displayFen, onMoveRaw, setLastUci } = args;
  const { showCorrectFlash, solvedCrownSquare } = usePuzzlePlayerEffects({
    solveIdx,
    status,
    displayFen,
  });
  const { onMove, onHint, onRetry, onNext, backToRoot } =
    usePuzzlePlayerHandlers({
      status,
      onMoveRaw,
      setLastUci,
      appendUsedHint: args.appendUsedHint,
      appendAbandoned: args.appendAbandoned,
      onRequestNext: args.onRequestNext,
    });
  return {
    showCorrectFlash,
    solvedCrownSquare,
    onMove,
    onHint,
    onRetry,
    onNext,
    backToRoot,
  };
}
