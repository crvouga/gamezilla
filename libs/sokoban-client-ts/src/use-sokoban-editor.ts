import type { PuzzleEditorProps } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import {
  eraseSokobanSquare,
  paintSokobanSquare,
  placeSokobanCrate,
  placeSokobanWorker,
  removeSokobanCrate,
  resizeSokobanBoard,
  type SokobanRemoval,
} from '@libs/sokoban-shared-ts/sokoban-board-edits';
import {
  decodeSokobanBoard,
  encodeSokobanBoard,
} from '@libs/sokoban-shared-ts/sokoban-definition';
import {
  type Cell,
  parseSquareName,
  type SokobanBoard,
  type Validation,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { createEffect, createMemo, createSignal, on } from 'solid-js';

export const SOKOBAN_TOOLS = [
  'wall',
  'floor',
  'goal',
  'outside',
  'worker',
  'crate',
  'remove-crate',
  'erase',
] as const;
export type SokobanTool = (typeof SOKOBAN_TOOLS)[number];

const EDITS: Readonly<
  Record<
    SokobanTool,
    (board: SokobanBoard, cell: Cell) => Validation<SokobanBoard>
  >
> = {
  wall: (board, cell) => paintSokobanSquare(board, cell, 'wall'),
  floor: (board, cell) => paintSokobanSquare(board, cell, 'floor'),
  goal: (board, cell) => paintSokobanSquare(board, cell, 'goal'),
  outside: (board, cell) => paintSokobanSquare(board, cell, 'outside'),
  worker: placeSokobanWorker,
  crate: placeSokobanCrate,
  'remove-crate': removeSokobanCrate,
  erase: eraseSokobanSquare,
};

/** One board edit at a time; the shared builder keeps every edit's draft. */
export function useSokobanEditor(props: PuzzleEditorProps) {
  const [tool, setTool] = createSignal<SokobanTool>('wall');
  const [refusal, setRefusal] = createSignal<{
    readonly code: string;
    readonly message: string;
  } | null>(null);
  const [removed, setRemoved] = createSignal<readonly SokobanRemoval[]>([]);
  const board = createMemo(() => {
    const decoded = decodeSokobanBoard(props.definition);
    return decoded.valid ? decoded.value : null;
  });
  let emitted: string | null = null;
  const keep = (next: SokobanBoard): void => {
    const encoded = encodeSokobanBoard(next);
    if (encoded === props.definition) return;
    emitted = encoded;
    props.onChange(encoded);
  };
  // A board changed elsewhere (undo, redo, another copy) clears this edit's notices.
  createEffect(
    on(
      () => props.definition,
      (definition) => {
        if (definition !== emitted) {
          setRemoved([]);
          setRefusal(null);
        }
        emitted = null;
      },
      { defer: true }
    )
  );
  const edit = (name: string): void => {
    const current = board();
    const cell = parseSquareName(name);
    if (current === null || cell === null || props.disabled) return;
    const next = EDITS[tool()](current, cell);
    setRemoved([]);
    if (!next.valid) {
      setRefusal(next.issues[0] ?? null);
      return;
    }
    setRefusal(null);
    keep(next.value);
  };
  const resize = (columns: number, rows: number): void => {
    const current = board();
    if (current === null || props.disabled) return;
    const next = resizeSokobanBoard(current, columns, rows);
    if (!next.valid) {
      setRemoved([]);
      setRefusal(next.issues[0] ?? null);
      return;
    }
    setRefusal(null);
    setRemoved(next.value.removed);
    keep(next.value.board);
  };
  return { board, tool, setTool, refusal, removed, edit, resize };
}
