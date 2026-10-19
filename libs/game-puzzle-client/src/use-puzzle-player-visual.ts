import type { HintStage } from '@libs/game-puzzle-shared/hint-stage';
import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared/play-attr';
import type { Accessor } from 'solid-js';
import type { PuzzleBoardMarks } from './puzzle-client';
import { usePuzzleBoardMarks } from './use-puzzle-board-marks';
import { usePuzzleStatusKind } from './use-puzzle-player-presentation';

export function usePuzzlePlayerVisual(args: {
  status: Accessor<PuzzlePlayStatus | 'loading'>;
  wrongMark: Accessor<string | null>;
  hintFrom: Accessor<string | null>;
  hintTo: Accessor<string | null>;
  hintStage: Accessor<HintStage>;
  atFrontier: Accessor<boolean>;
}): {
  statusKind: ReturnType<typeof usePuzzleStatusKind>;
  marks: Accessor<PuzzleBoardMarks>;
} {
  return {
    statusKind: usePuzzleStatusKind(args.status),
    marks: usePuzzleBoardMarks(args),
  };
}
