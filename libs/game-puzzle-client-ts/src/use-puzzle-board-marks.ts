import type { HintStage } from '@libs/game-puzzle-shared-ts/hint-stage';
import type { PuzzlePlayStatus } from '@libs/game-puzzle-shared-ts/play-attr';
import { type Accessor, createMemo } from 'solid-js';
import type { PuzzleBoardMarks } from './puzzle-client';

/**
 * What the board marks: the cell a wrong move ended on, the cell a hint
 * picks while the solver is to move, and — at the latest position, once the
 * hint shows it — the solution move.
 */
export function usePuzzleBoardMarks(args: {
  status: Accessor<PuzzlePlayStatus | 'loading'>;
  wrongMark: Accessor<string | null>;
  hintFrom: Accessor<string | null>;
  hintTo: Accessor<string | null>;
  hintStage: Accessor<HintStage>;
  atFrontier: Accessor<boolean>;
}): Accessor<PuzzleBoardMarks> {
  return createMemo((): PuzzleBoardMarks => {
    const from = args.hintFrom();
    const to = args.hintTo();
    return {
      wrong: args.wrongMark(),
      hint: args.status() === 'solving' ? from : null,
      solution:
        args.atFrontier() &&
        args.hintStage() === 'solution' &&
        from !== null &&
        to !== null
          ? { from, to }
          : null,
    };
  });
}
