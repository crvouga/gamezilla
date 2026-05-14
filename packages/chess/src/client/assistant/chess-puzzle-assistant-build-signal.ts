import {
  defineSignal,
  type AssistantSignal,
} from '@gamezilla/assistant/shared';

import type { SolveStatus } from '../chess-puzzle/use-chess-puzzle-solver';
import type { ChessPuzzleAssistantPayload } from './chess-puzzle-assistant-adapter';
import { CHESS_PUZZLE_SIGNAL } from './chess-puzzle-assistant-signals';

export function buildChessPuzzleAssistantSignal(args: {
  readonly prevStatus: SolveStatus | null;
  readonly status: SolveStatus;
  readonly solveIdx: number;
  readonly themes: readonly string[];
}): AssistantSignal<ChessPuzzleAssistantPayload> | null {
  const { prevStatus, status, solveIdx, themes } = args;
  if (status === 'loading') return null;
  if (status === 'invalid') {
    return defineSignal({
      kind: CHESS_PUZZLE_SIGNAL.invalid,
      tags: ['invalid'],
      payload: { themes },
    });
  }
  if (status === 'wrong') {
    return defineSignal({
      kind: CHESS_PUZZLE_SIGNAL.wrong,
      tags: ['wrong'],
      payload: { themes },
    });
  }
  if (status === 'solved') {
    return defineSignal({
      kind: CHESS_PUZZLE_SIGNAL.solved,
      tags: ['solved'],
      payload: { themes },
    });
  }
  if (prevStatus === 'wrong') {
    return defineSignal({
      kind: CHESS_PUZZLE_SIGNAL.retry,
      tags: ['retry'],
      payload: { themes },
    });
  }
  if (solveIdx <= 1) {
    return defineSignal({
      kind: CHESS_PUZZLE_SIGNAL.start,
      tags: ['start'],
      payload: { themes },
    });
  }
  return defineSignal({
    kind: CHESS_PUZZLE_SIGNAL.progress,
    tags: ['progress', 'moveCorrect'],
    payload: { themes },
  });
}
