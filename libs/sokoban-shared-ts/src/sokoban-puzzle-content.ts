import type {
  PuzzleChange,
  PuzzleContent,
  PuzzleEvidence,
  PuzzleValidation,
} from '@pkgs/turn-game-shared-ts/puzzle-content';
import { validateSokobanDefinition } from './sokoban-definition';
import {
  applySokobanMove,
  decodeSokobanAction,
  decodeSokobanPosition,
  encodeSokobanPosition,
  initialSokobanPosition,
  sokobanComplete,
} from './sokoban-position';
import { sokobanStarterPack } from './sokoban-starter-pack';
import type {
  SokobanBoard,
  SokobanPosition,
  Validation,
} from './sokoban-types';

function validation<T>(result: Validation<T>): PuzzleValidation {
  return result.valid ? { valid: true } : result;
}

function change(result: Validation<SokobanPosition>): PuzzleChange {
  return result.valid
    ? { accepted: true, state: encodeSokobanPosition(result.value) }
    : { accepted: false, issues: result.issues };
}

function readPosition(
  definition: string,
  state: string
): Validation<{
  readonly board: SokobanBoard;
  readonly position: SokobanPosition;
}> {
  const board = validateSokobanDefinition(definition);
  if (!board.valid) return board;
  const position = decodeSokobanPosition(board.value, state);
  if (!position.valid) return position;
  return {
    valid: true,
    value: { board: board.value, position: position.value },
  };
}

function apply(
  definition: string,
  state: string,
  action: string
): PuzzleChange {
  const read = readPosition(definition, state);
  if (!read.valid) return { accepted: false, issues: read.issues };
  const direction = decodeSokobanAction(action);
  if (!direction.valid) return { accepted: false, issues: direction.issues };
  return change(
    applySokobanMove(read.value.board, read.value.position, direction.value)
  );
}

function complete(definition: string, state: string): boolean {
  const read = readPosition(definition, state);
  return read.valid && sokobanComplete(read.value.board, read.value.position);
}

/**
 * Proof is a completed playtest of exactly this board. The platform has
 * replayed the evidence under the current rules before asking.
 */
function validatePublication(
  definition: string,
  evidence?: PuzzleEvidence
): PuzzleValidation {
  const board = validateSokobanDefinition(definition);
  if (!board.valid) return board;
  if (evidence !== undefined && complete(definition, evidence.state))
    return { valid: true };
  return {
    valid: false,
    issues: [
      {
        code: 'needs_playtest',
        message: 'Complete a playtest of this board before publication.',
      },
    ],
  };
}

export const sokobanPuzzleContent: PuzzleContent = {
  rulesVersion: 1,
  history: 'snapshots',
  rules: {
    validateDefinition: (definition) =>
      validation(validateSokobanDefinition(definition)),
    initial: (definition) => {
      const board = validateSokobanDefinition(definition);
      return board.valid
        ? change(initialSokobanPosition(board.value))
        : { accepted: false, issues: board.issues };
    },
    validateState: (definition, state) =>
      validation(readPosition(definition, state)),
    apply,
    complete,
  },
  validatePublication,
  statistics: (definition, state) => {
    const read = readPosition(definition, state);
    return read.valid
      ? { moves: read.value.position.moves, pushes: read.value.position.pushes }
      : {};
  },
  bundledPacks: [sokobanStarterPack],
};
