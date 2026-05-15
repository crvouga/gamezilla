import type { ChessPuzzlePlayStatus } from '../../shared/chess-puzzle-play';
import { useChessPuzzleAssistant } from '../assistant/use-chess-puzzle-assistant';
import { chessPuzzleStatusKindFromState } from './chess-puzzle-status-from-state';

export function usePuzzlePlayerPresentation(args: {
  puzzleId: string;
  status: ChessPuzzlePlayStatus | 'loading';
  solveIdx: number;
  themes: readonly string[];
  layoutKey: number;
  orientation: 'white' | 'black';
  showCorrectFlash: boolean;
}) {
  const {
    puzzleId,
    status,
    solveIdx,
    themes,
    layoutKey,
    orientation,
    showCorrectFlash,
  } = args;

  const assistant = useChessPuzzleAssistant({
    puzzleId,
    status,
    solveIdx,
    themes,
    layoutKey,
  });

  const statusKind = chessPuzzleStatusKindFromState({
    status,
    orientation,
    showCorrectFlash,
  });

  return { assistant, statusKind };
}
