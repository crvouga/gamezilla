import { offeredDraftEdits } from '@libs/game-puzzle-harness-ts/builder-session';
import { decodeSokobanBoard } from '@libs/sokoban-shared-ts/sokoban-definition';
import {
  type SokobanBoard,
  squareName,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import {
  builderSays,
  buildSokobanBoard,
  builtDefinition,
  previewWords,
} from './sokoban-building';
import type { SokobanHarness } from './sokoban-system';

/** A square of the board-building model: columns and rows counted from 1. */
export type ModelSquare = { readonly column: number; readonly row: number };

export function modelSquareName(square: ModelSquare): string {
  return squareName({ x: square.column - 1, y: square.row - 1 });
}

const EMPTY = [
  ['', 'A', 'B', 'C'],
  ['1', 'floor', 'floor', 'floor'],
  ['2', 'floor', 'floor', 'floor'],
];
const FINISHED = [
  ['', 'A', 'B', 'C'],
  ['1', 'worker', 'crate', 'goal'],
  ['2', 'floor', 'floor', 'floor'],
];

export const setupBoardBuilding = defineAction({
  name: 'setupBoardBuilding',
  act: (s: SokobanHarness, finished: boolean) =>
    buildSokobanBoard.act(s, finished ? FINISHED : EMPTY),
});

function squaresOf(board: SokobanBoard, kind: string): Set<ModelSquare> {
  return new Set(
    board.squares.flatMap((square, index) =>
      square === kind
        ? [
            {
              column: (index % board.width) + 1,
              row: Math.floor(index / board.width) + 1,
            },
          ]
        : []
    )
  );
}

const at = (cell: { readonly x: number; readonly y: number }) => ({
  column: cell.x + 1,
  row: cell.y + 1,
});

export function modelBoard(definition: string) {
  const board = decodeSokobanBoard(definition);
  if (!board.valid) throw new Error('The built board is unreadable');
  const value = board.value;
  return {
    columns: value.width,
    rows: value.height,
    walls: squaresOf(value, 'wall'),
    goals: squaresOf(value, 'goal'),
    outside: squaresOf(value, 'outside'),
    worker: new Set(value.worker === null ? [] : [at(value.worker)]),
    crates: new Set(value.crates.map(at)),
  };
}

const SYMBOLS: Readonly<Record<string, string>> = {
  wall: '#',
  floor: ' ',
  goal: '.',
  outside: '~',
  worker: '@',
  'worker on goal': '+',
  crate: '$',
  'crate on goal': '*',
};

const CORRECTIONS: Readonly<Record<string, string>> = {
  needs_worker: 'missing worker',
  needs_crate: 'no crates',
  crate_goal_mismatch: 'crate and goal counts differ',
};

export async function boardBuildingState(s: SokobanHarness) {
  const says = await builderSays(s);
  const preview = await previewWords(s);
  const offered = await offeredDraftEdits(s, 'alice:phone');
  return {
    board: modelBoard(await builtDefinition(s)),
    preview: modelBoard(
      JSON.stringify({
        format: 1,
        rows: preview.map((row) =>
          row.map((word) => SYMBOLS[word] ?? '?').join('')
        ),
      })
    ),
    corrections: new Set(
      says.corrections.map((code) => CORRECTIONS[code] ?? code)
    ),
    removedBeyondEdge: new Set(
      says.removed
        .split(',')
        .filter((entry) => entry.length > 0)
        .map((entry) => {
          const [kind, name] = entry.split(' ');
          const column = (name ?? 'A').charCodeAt(0) - 64;
          return {
            kind: kind ?? '',
            square: { column, row: Number(name?.slice(1)) },
          };
        })
    ),
    undoOffered: offered.undo,
    redoOffered: offered.redo,
  };
}

export const SOKOBAN_BUILDING_MODEL_ACTIONS = [setupBoardBuilding] as const;
