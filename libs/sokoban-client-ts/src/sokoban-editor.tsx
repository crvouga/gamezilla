import type { PuzzleEditorProps } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { sokobanCorrections } from '@libs/sokoban-shared-ts/sokoban-definition';
import {
  type SokobanBoard,
  sameCell,
  squareName,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import {
  CellGridBoard,
  type CellGridCell,
} from '@pkgs/ui-root-client-ts/cell-grid-board';
import {
  CellGridPalette,
  type CellGridPaletteItem,
} from '@pkgs/ui-root-client-ts/cell-grid-palette';
import { EditorWorkbench } from '@pkgs/ui-root-client-ts/editor-workbench';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { createMemo, For, type JSX, Show } from 'solid-js';
import { cellOf, squareLabel } from './sokoban-board-view';
import { SokobanSizeControls } from './sokoban-size-controls';
import {
  SOKOBAN_TOOLS,
  type SokobanTool,
  useSokobanEditor,
} from './use-sokoban-editor';
import { useSokobanWords } from './use-sokoban-words';

type Editor = ReturnType<typeof useSokobanEditor>;

/** What a square shows: its piece's glyph and the token it is drawn as. */
function pieceOf(
  board: SokobanBoard,
  index: number
): Pick<CellGridCell, 'glyph' | 'identity'> {
  const cell = cellOf(board, index);
  const square = board.squares[index];
  if (board.worker !== null && sameCell(board.worker, cell))
    return { glyph: '☻', identity: 'three' };
  if (board.crates.some((crate) => sameCell(crate, cell)))
    return square === 'goal'
      ? { glyph: '▣', identity: 'two' }
      : { glyph: '▢', identity: 'one' };
  // A wall is drawn by its fill (the board's `occupied` tone), not a glyph.
  if (square === 'goal') return { glyph: '', identity: 'four' };
  return { glyph: square === 'outside' ? '·' : '', identity: undefined };
}

/** What each tool lays down, drawn as the board draws that square. */
const SWATCHES: Readonly<
  Record<SokobanTool, Omit<CellGridPaletteItem<SokobanTool>, 'key' | 'label'>>
> = {
  wall: { tone: 'occupied' },
  floor: { tone: 'open' },
  goal: { tone: 'open', identity: 'four' },
  outside: { tone: 'quiet', glyph: '·' },
  worker: { tone: 'open', glyph: '☻', identity: 'three' },
  crate: { tone: 'open', glyph: '▢', identity: 'one' },
  'remove-crate': { tone: 'open', glyph: '−', identity: 'one' },
  erase: { tone: 'open', glyph: '✕' },
};

/**
 * One tool at a time, as one segmented picker: squares to lay down, then
 * the pieces to place or take away, each a swatch of what it lays down.
 */
function ToolPalette(props: { editor: Editor; disabled: boolean }) {
  const { t } = useLingui();
  const names = (): Readonly<Record<SokobanTool, string>> => ({
    wall: t`Wall`,
    floor: t`Floor`,
    goal: t`Goal`,
    outside: t`Outside`,
    worker: t`Worker`,
    crate: t`Crate`,
    'remove-crate': t`Lift crate`,
    erase: t`Erase`,
  });
  return (
    <CellGridPalette
      label={t`Tool`}
      boardTheme="sokoban"
      items={SOKOBAN_TOOLS.map((tool) => ({
        key: tool,
        label: names()[tool],
        testid: `sokoban-tool-${tool}`,
        ...SWATCHES[tool],
      }))}
      selected={props.editor.tool()}
      onSelect={(tool) => props.editor.setTool(tool)}
      disabled={props.disabled}
      dataSet={{ testid: 'sokoban-tools' }}
    />
  );
}

function Feedback(props: { editor: Editor; board: SokobanBoard }) {
  const { t } = useLingui();
  const words = useSokobanWords();
  const corrections = createMemo(() => sokobanCorrections(props.board));
  const removed = () =>
    props.editor
      .removed()
      .map((entry) => `${entry.kind} ${squareName(entry.cell)}`);
  return (
    <>
      <Show when={props.editor.refusal()}>
        {(refused) => (
          <Notice
            tone="warning"
            dataSet={{ testid: 'sokoban-edit-refusal', code: refused().code }}
          >
            {words.refusal(refused().code, refused().message)}
          </Notice>
        )}
      </Show>
      <Show when={removed().length > 0}>
        <Notice
          dataSet={{ testid: 'sokoban-removed', removed: removed().join(',') }}
        >
          {t`The smaller board removed: ${removed().join(', ')}.`}
        </Notice>
      </Show>
      <Show
        when={corrections().length > 0}
        fallback={
          <Notice tone="success" dataSet={{ testid: 'sokoban-ready' }}>
            <Trans>Nothing to correct. Playtest the board to prove it.</Trans>
          </Notice>
        }
      >
        <Notice tone="warning" dataSet={{ testid: 'sokoban-corrections' }}>
          <StackVertical gap="xs">
            <For each={corrections()}>
              {(issue) => (
                <P dataSet={{ testid: `sokoban-correction-${issue.code}` }}>
                  {words.refusal(issue.code, issue.message)}
                </P>
              )}
            </For>
          </StackVertical>
        </Notice>
      </Show>
    </>
  );
}

function Board(props: {
  editor: Editor;
  board: SokobanBoard;
  disabled: boolean;
}) {
  const { t } = useLingui();
  const words = useSokobanWords();
  const columns = () =>
    Array.from({ length: props.board.width }, (_, x) =>
      String.fromCharCode(65 + x)
    );
  const rows = () =>
    Array.from({ length: props.board.height }, (_, y) => String(y + 1));
  // Memoized: each square reads the list, so computing it inline would
  // rebuild the whole board once per square on every change.
  const cells = createMemo((): readonly CellGridCell[] =>
    props.board.squares.map((square, index) => ({
      id: squareName(cellOf(props.board, index)),
      ...pieceOf(props.board, index),
      label: squareLabel(props.board, props.board, index, words),
      tone:
        square === 'wall'
          ? 'occupied'
          : square === 'outside'
            ? 'quiet'
            : 'open',
      enabled: !props.disabled,
    }))
  );
  return (
    <CellGridBoard
      boardTheme="sokoban"
      label={t`Sokoban board being built`}
      testId="sokoban-editor-board"
      cellTestId={(id) => `sokoban-square-${id}`}
      columnLabels={columns()}
      rowLabels={rows()}
      cells={cells()}
      onActivate={props.editor.edit}
    />
  );
}

/** The shared builder owns saving, undo, validation, playtesting and publication. */
export function SokobanEditor(props: PuzzleEditorProps): JSX.Element {
  const editor = useSokobanEditor(props);
  return (
    <Show
      when={editor.board()}
      fallback={
        <Notice tone="error">
          <Trans>
            This board cannot be opened. Choose an earlier saved draft to keep
            building.
          </Trans>
        </Notice>
      }
    >
      {(board) => (
        // The tools sit beside the board when there is room and head it on
        // a phone, with the size a closed row there, so the board is in
        // view with every control that shapes it; how to use the tools and
        // what to correct follow the tools beside it, or the board.
        <EditorWorkbench
          tools={
            <>
              <SokobanSizeControls
                board={board()}
                disabled={props.disabled}
                onResize={editor.resize}
              />
              <ToolPalette editor={editor} disabled={props.disabled} />
            </>
          }
          canvas={
            <Board editor={editor} board={board()} disabled={props.disabled} />
          }
          notes={
            <>
              <P variant="caption" tone="secondary">
                <Trans>
                  Choose a tool, then a square. Walls and outside squares remove
                  any piece on them; erasing makes plain floor.
                </Trans>
              </P>
              <Feedback editor={editor} board={board()} />
            </>
          }
        />
      )}
    </Show>
  );
}
