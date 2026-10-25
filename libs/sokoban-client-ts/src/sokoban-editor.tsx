import type { PuzzleEditorProps } from '@libs/game-puzzle-client-ts/puzzle-content-client';
import { sokobanCorrections } from '@libs/sokoban-shared-ts/sokoban-definition';
import {
  type SokobanBoard,
  sameCell,
  squareName,
} from '@libs/sokoban-shared-ts/sokoban-types';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import {
  CellGridBoard,
  type CellGridCell,
} from '@pkgs/ui-root-client-ts/cell-grid-board';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
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

function glyphOf(board: SokobanBoard, index: number): string {
  const cell = cellOf(board, index);
  const square = board.squares[index];
  if (board.worker !== null && sameCell(board.worker, cell)) return '☻';
  if (board.crates.some((crate) => sameCell(crate, cell)))
    return square === 'goal' ? '▣' : '▢';
  return square === 'wall'
    ? '█'
    : square === 'goal'
      ? '○'
      : square === 'outside'
        ? '·'
        : '';
}

function ToolPalette(props: { editor: Editor; disabled: boolean }) {
  const { t } = useLingui();
  const names = (): Readonly<Record<SokobanTool, string>> => ({
    wall: t`Wall`,
    floor: t`Floor`,
    goal: t`Goal`,
    outside: t`Outside`,
    worker: t`Worker`,
    crate: t`Crate`,
    'remove-crate': t`Remove crate`,
    erase: t`Erase`,
  });
  return (
    <StackHorizontal gap="sm" wrap>
      <For each={SOKOBAN_TOOLS}>
        {(tool) => (
          <Button
            title={names()[tool]}
            intent="neutral"
            variant={props.editor.tool() === tool ? 'solid' : 'outline'}
            aria-pressed={props.editor.tool() === tool}
            disabled={props.disabled}
            onClick={() => props.editor.setTool(tool)}
            dataSet={{ testid: `sokoban-tool-${tool}` }}
          />
        )}
      </For>
    </StackHorizontal>
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
  const cells = (): readonly CellGridCell[] =>
    props.board.squares.map((square, index) => ({
      id: squareName(cellOf(props.board, index)),
      glyph: glyphOf(props.board, index),
      label: squareLabel(props.board, props.board, index, words),
      tone:
        square === 'wall'
          ? 'occupied'
          : square === 'outside'
            ? 'quiet'
            : 'open',
      enabled: !props.disabled,
    }));
  return (
    <CellGridBoard
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
        <StackVertical gap="lg">
          <SokobanSizeControls
            board={board()}
            disabled={props.disabled}
            onResize={editor.resize}
          />
          <ToolPalette editor={editor} disabled={props.disabled} />
          <Board editor={editor} board={board()} disabled={props.disabled} />
          <P variant="caption" tone="secondary">
            <Trans>
              Choose a tool, then a square. Walls and outside squares remove any
              piece on them; erasing makes plain floor.
            </Trans>
          </P>
          <Feedback editor={editor} board={board()} />
        </StackVertical>
      )}
    </Show>
  );
}
