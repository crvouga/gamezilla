import type {
  PuzzleChange,
  PuzzleContent,
  PuzzleEvidence,
  PuzzleSolution,
  PuzzleValidation,
} from '@pkgs/turn-game-shared-ts/puzzle-content';
import { z } from 'zod';
import { numberlinkCatalogPacks } from './numberlink-catalog';
import { decodeNumberlinkDefinition } from './numberlink-definition';
import { solveNumberlink } from './numberlink-solver';
import {
  applyNumberlinkAction,
  connectedPairs,
  decodeNumberlinkState,
  encodeNumberlinkState,
  numberlinkComplete,
} from './numberlink-state';
import type {
  NumberlinkDefinition,
  NumberlinkState,
  Validation,
} from './numberlink-types';

const actionSchema = z
  .object({
    pairId: z.string().min(1).max(64),
    cells: z
      .array(z.object({ x: z.number().int(), y: z.number().int() }).strict())
      .max(400),
  })
  .strict();

// Every rule call for a move reads the same board. Keep the last one read,
// privately, so a sequence of moves decodes its board once.
let lastBoard:
  | { definition: string; checked: Validation<NumberlinkDefinition> }
  | undefined;

function readBoard(definition: string): Validation<NumberlinkDefinition> {
  if (lastBoard?.definition === definition) return lastBoard.checked;
  const checked = decodeNumberlinkDefinition(definition);
  lastBoard = { definition, checked };
  return checked;
}

// A move starts from the progress the previous move wrote; keep that one too.
let lastProgress:
  | {
      board: NumberlinkDefinition;
      state: string;
      checked: Validation<NumberlinkState>;
    }
  | undefined;

function readProgress(
  board: NumberlinkDefinition,
  state: string
): Validation<NumberlinkState> {
  if (lastProgress?.board === board && lastProgress.state === state)
    return lastProgress.checked;
  const checked = decodeNumberlinkState(board, state);
  lastProgress = { board, state, checked };
  return checked;
}

function validation<T>(result: Validation<T>): PuzzleValidation {
  return result.valid ? { valid: true } : result;
}

function stateChange(
  definition: NumberlinkDefinition,
  result: Validation<NumberlinkState>
): PuzzleChange {
  if (!result.valid) return { accepted: false, issues: result.issues };
  const state = encodeNumberlinkState(definition, result.value);
  lastProgress = { board: definition, state, checked: result };
  return { accepted: true, state };
}

function apply(
  definition: string,
  state: string,
  action: string
): PuzzleChange {
  const board = readBoard(definition);
  if (!board.valid) return { accepted: false, issues: board.issues };
  const progress = readProgress(board.value, state);
  if (!progress.valid) return { accepted: false, issues: progress.issues };
  try {
    const parsed = actionSchema.safeParse(JSON.parse(action));
    if (parsed.success)
      return stateChange(
        board.value,
        applyNumberlinkAction(board.value, progress.value, parsed.data)
      );
  } catch {
    /* An unreadable gesture is refused atomically. */
  }
  return {
    accepted: false,
    issues: [
      {
        code: 'invalid_action',
        message: 'This path cannot be read. Draw the path again.',
      },
    ],
  };
}

function solve(definition: string): PuzzleSolution {
  const board = readBoard(definition);
  if (!board.valid) return { status: 'invalid', issues: board.issues };
  const result = solveNumberlink(board.value, { checkUniqueness: true });
  if (result.status !== 'solved') return result;
  return {
    status: 'solved',
    state: encodeNumberlinkState(board.value, result.solution),
    uniqueness: result.uniqueness,
  };
}

function complete(definition: string, state: string): boolean {
  const board = readBoard(definition);
  if (!board.valid) return false;
  const progress = readProgress(board.value, state);
  return progress.valid && numberlinkComplete(board.value, progress.value);
}

/** A completed playtest replay proves the drawing; otherwise the bounded solver must. */
function validatePublication(
  definition: string,
  evidence?: PuzzleEvidence
): PuzzleValidation {
  const board = readBoard(definition);
  if (!board.valid) return board;
  if (evidence !== undefined)
    return complete(definition, evidence.state)
      ? { valid: true }
      : {
          valid: false,
          issues: [
            {
              code: 'invalid_solution',
              message:
                'Finish a valid playtest before publishing this drawing.',
            },
          ],
        };
  const result = solve(definition);
  if (result.status === 'solved') return { valid: true };
  if (result.status === 'invalid')
    return { valid: false, issues: result.issues };
  return {
    valid: false,
    issues: [
      {
        code: result.status,
        message:
          result.status === 'unsolvable'
            ? 'No solution connects these endpoints under the chosen coverage. Edit the drawing.'
            : 'The search could not prove a solution. Finish a playtest and publish that proof.',
      },
    ],
  };
}

export const numberlinkPuzzleContent: PuzzleContent = {
  rulesVersion: 1,
  history: 'snapshots',
  rules: {
    validateDefinition: (definition) => validation(readBoard(definition)),
    initial: (definition) => {
      const board = readBoard(definition);
      return board.valid
        ? stateChange(board.value, { valid: true, value: { paths: [] } })
        : { accepted: false, issues: board.issues };
    },
    validateState: (definition, state) => {
      const board = readBoard(definition);
      return board.valid ? validation(readProgress(board.value, state)) : board;
    },
    apply,
    complete,
  },
  solver: { solve },
  validatePublication,
  bundledPacks: numberlinkCatalogPacks,
  statistics: (definition, state) => {
    const board = readBoard(definition);
    if (!board.valid) return {};
    const progress = readProgress(board.value, state);
    if (!progress.valid) return {};
    return {
      connectedPairs: connectedPairs(board.value, progress.value).length,
      coveredCells: progress.value.paths.reduce(
        (total, path) => total + path.cells.length,
        0
      ),
    };
  },
};
