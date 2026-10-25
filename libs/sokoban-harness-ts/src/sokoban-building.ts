import {
  openBuilder,
  settleBuilder,
} from '@libs/game-puzzle-harness-ts/builder-session';
import { workingDefinitionOnDevice } from '@libs/game-puzzle-harness-ts/content-game-reads';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { fireEvent } from '@solidjs/testing-library';
import { createSokobanDraft } from './sokoban-fixtures';
import { type LayoutTable, layoutDefinition } from './sokoban-layout';
import { type View, waitFor } from './sokoban-screen';
import type { SokobanHarness } from './sokoban-system';

const ALICE = 'alice:phone';
/** The board before the last board edit, to tell a refused edit changed nothing. */
const BEFORE = new WeakMap<SokobanHarness, string>();

function buildingDocument(s: SokobanHarness): string {
  const id = s.editors.get(ALICE)?.documentId;
  if (id === undefined) throw new Error('Alice is not building a board');
  return id;
}

export async function openSokobanBuilder(s: SokobanHarness): Promise<View> {
  const view = await openBuilder(s, ALICE, buildingDocument(s));
  await waitFor(s, () => view.queryByTestId('sokoban-editor-board') !== null);
  return view;
}

export async function builtDefinition(s: SokobanHarness): Promise<string> {
  return (await workingDefinitionOnDevice(s, ALICE, buildingDocument(s))) ?? '';
}

async function editInBuilder(
  s: SokobanHarness,
  act: (view: View) => void
): Promise<void> {
  const view = await openSokobanBuilder(s);
  BEFORE.set(s, await builtDefinition(s));
  act(view);
  await settleBuilder(s, ALICE);
}

export const ownSokobanDraft = defineAction({
  name: 'ownSokobanDraft',
  act: async (s: SokobanHarness, title: string, table: LayoutTable) => {
    await createSokobanDraft(s, ALICE, {
      title,
      definition: layoutDefinition(table),
    });
  },
});

export const buildSokobanBoard = defineAction({
  name: 'buildSokobanBoard',
  act: async (s: SokobanHarness, table: LayoutTable) => {
    await createSokobanDraft(s, ALICE, {
      title: 'Warehouse',
      definition: layoutDefinition(table),
    });
    await openSokobanBuilder(s);
  },
});

export type SokobanTool =
  | 'wall'
  | 'floor'
  | 'goal'
  | 'outside'
  | 'worker'
  | 'crate'
  | 'remove-crate'
  | 'erase';

/** Chooses a builder tool, then the square, as the author does. */
export function editSquare(
  s: SokobanHarness,
  tool: SokobanTool,
  square: string
): Promise<void> {
  return editInBuilder(s, (view) => {
    fireEvent.click(view.getByTestId(`sokoban-tool-${tool}`));
    fireEvent.click(view.getByTestId(`sokoban-square-${square}`));
  });
}

export const editSokobanSquare = defineAction({
  name: 'editSokobanSquare',
  act: editSquare,
});

export const resizeSokobanBoard = defineAction({
  name: 'resizeSokobanBoard',
  act: (s: SokobanHarness, columns: number, rows: number) =>
    editInBuilder(s, (view) => {
      fireEvent.input(view.getByLabelText('Columns'), {
        target: { value: String(columns) },
      });
      fireEvent.input(view.getByLabelText('Rows'), {
        target: { value: String(rows) },
      });
      fireEvent.click(view.getByTestId('sokoban-resize'));
    }),
});

export async function boardBeforeEdit(s: SokobanHarness): Promise<string> {
  return BEFORE.get(s) ?? (await builtDefinition(s));
}

/** What the builder says: a refused edit's reason and the corrections it lists. */
export async function builderSays(s: SokobanHarness) {
  const view = await openSokobanBuilder(s);
  return {
    refusal:
      view.queryByTestId('sokoban-edit-refusal')?.getAttribute('data-code') ??
      null,
    corrections: ['needs_worker', 'needs_crate', 'crate_goal_mismatch'].filter(
      (code) => view.queryByTestId(`sokoban-correction-${code}`) !== null
    ),
    ready: view.queryByTestId('sokoban-ready') !== null,
    removed:
      view.queryByTestId('sokoban-removed')?.getAttribute('data-removed') ?? '',
  };
}

const PIECES = ['worker', 'crate'];

/** The preview's squares as the specifications name them, row by row. */
export async function previewWords(
  s: SokobanHarness
): Promise<readonly (readonly string[])[]> {
  const view = await openSokobanBuilder(s);
  fireEvent.click(view.getByTestId('content-preview'));
  await waitFor(s, () => view.queryByTestId('sokoban-preview') !== null);
  const board = view.getByTestId('sokoban-preview');
  const columns = Number(board.style.getPropertyValue('--tile-board-columns'));
  const words = [
    ...board.querySelectorAll('[data-testid^="sokoban-preview-tile-"]'),
  ].map((tile) => {
    const [terrain, piece] = (tile.getAttribute('aria-label') ?? '')
      .replace(/^[A-T]\d+: /, '')
      .split(', ');
    if (piece === undefined || !PIECES.includes(piece)) return terrain ?? '';
    return terrain === 'goal' ? `${piece} on goal` : piece;
  });
  fireEvent.click(view.getByTestId('content-preview'));
  const rows: string[][] = [];
  for (let index = 0; index < words.length; index += columns)
    rows.push(words.slice(index, index + columns));
  return rows;
}

export const SOKOBAN_BUILDING_ACTIONS = [
  ownSokobanDraft,
  buildSokobanBoard,
  editSokobanSquare,
  resizeSokobanBoard,
] as const;
