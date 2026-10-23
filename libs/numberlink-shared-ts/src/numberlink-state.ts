import { z } from 'zod';
import { validateNumberlinkDefinition } from './numberlink-definition';
import { endpointOwners, pathIssues } from './numberlink-path-validation';
import {
  type NumberlinkAction,
  type NumberlinkDefinition,
  type NumberlinkIssue,
  type NumberlinkPath,
  type NumberlinkState,
  sameCell,
  type Validation,
} from './numberlink-types';

const cellSchema = z
  .object({ x: z.number().int(), y: z.number().int() })
  .strict();
export const numberlinkStateSchema = z
  .object({
    paths: z
      .array(
        z
          .object({
            pairId: z.string().min(1).max(64),
            cells: z.array(cellSchema).min(1).max(400),
          })
          .strict()
      )
      .max(200),
  })
  .strict();

export function validateNumberlinkState(
  definition: NumberlinkDefinition,
  input: unknown
): Validation<NumberlinkState> {
  const board = validateNumberlinkDefinition(definition);
  if (!board.valid) return board;
  const parsed = numberlinkStateSchema.safeParse(input);
  if (!parsed.success)
    return {
      valid: false,
      issues: [
        {
          code: 'invalid_state',
          message:
            'This progress cannot be read. Keep your saved attempt and open another attempt.',
        },
      ],
    };
  const issues: NumberlinkIssue[] = [];
  const occupied = new Set<string>();
  const seen = new Set<string>();
  const endpoints = endpointOwners(board.value);
  for (const path of parsed.data.paths) {
    const pair = board.value.pairs.find((entry) => entry.id === path.pairId);
    if (pair === undefined)
      issues.push({
        code: 'unknown_pair',
        message: 'Choose a pair on this board.',
        pairId: path.pairId,
      });
    else if (seen.has(path.pairId))
      issues.push({
        code: 'duplicate_path',
        message: 'Each pair has only one path.',
        pairId: path.pairId,
      });
    else
      issues.push(
        ...pathIssues(path, {
          definition: board.value,
          pair,
          occupied,
          endpoints,
        })
      );
    seen.add(path.pairId);
  }
  return issues.length === 0
    ? { valid: true, value: parsed.data }
    : { valid: false, issues };
}

export function connectedPairs(
  definition: NumberlinkDefinition,
  state: NumberlinkState
): readonly string[] {
  return definition.pairs
    .filter((pair) => {
      const path = state.paths.find((entry) => entry.pairId === pair.id);
      if (path === undefined || path.cells.length < 2) return false;
      const first = path.cells[0]!;
      const last = path.cells[path.cells.length - 1]!;
      return (
        pair.endpoints.some((cell) => sameCell(cell, first)) &&
        pair.endpoints.some((cell) => sameCell(cell, last)) &&
        !sameCell(first, last)
      );
    })
    .map((pair) => pair.id);
}

export function numberlinkComplete(
  definition: NumberlinkDefinition,
  state: NumberlinkState
): boolean {
  if (!validateNumberlinkState(definition, state).valid) return false;
  if (connectedPairs(definition, state).length !== definition.pairs.length)
    return false;
  return (
    definition.coverage === 'pairs' ||
    state.paths.reduce((count, path) => count + path.cells.length, 0) ===
      definition.width * definition.height
  );
}

/** Reject a whole invalid gesture without changing any other path. */
export function applyNumberlinkAction(
  definition: NumberlinkDefinition,
  state: NumberlinkState,
  action: NumberlinkAction
): Validation<NumberlinkState> {
  const current = validateNumberlinkState(definition, state);
  if (!current.valid) return current;
  if (!definition.pairs.some((pair) => pair.id === action.pairId))
    return {
      valid: false,
      issues: [
        { code: 'unknown_pair', message: 'Choose a pair on this board.' },
      ],
    };
  const remaining = current.value.paths.filter(
    (path) => path.pairId !== action.pairId
  );
  const paths: readonly NumberlinkPath[] =
    action.cells.length === 0
      ? remaining
      : [...remaining, { pairId: action.pairId, cells: action.cells }];
  return validateNumberlinkState(definition, { paths });
}

export function decodeNumberlinkState(
  definition: NumberlinkDefinition,
  text: string
): Validation<NumberlinkState> {
  try {
    return validateNumberlinkState(definition, JSON.parse(text));
  } catch {
    return {
      valid: false,
      issues: [
        {
          code: 'invalid_json',
          message:
            'This progress cannot be read. Keep the saved attempt and open another attempt.',
        },
      ],
    };
  }
}

export function encodeNumberlinkState(
  definition: NumberlinkDefinition,
  state: NumberlinkState
): string {
  const checked = validateNumberlinkState(definition, state);
  if (!checked.valid)
    throw new Error('Cannot encode invalid Numberlink progress');
  return JSON.stringify(checked.value);
}
