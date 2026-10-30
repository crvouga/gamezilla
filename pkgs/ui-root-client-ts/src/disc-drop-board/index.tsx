import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  createMemo,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  Show,
} from 'solid-js';
import styles from './disc-drop-board.module.css';
export type DiscDropBoardProps = {
  readonly cells: readonly number[];
  readonly columns: number;
  readonly rows: number;
  readonly active: number;
  readonly winning: readonly number[];
  readonly interactive: boolean;
  readonly lastCell?: number | undefined;
  readonly label: string;
  readonly testId: string;
  readonly columnTestId: (column: number) => string;
  readonly cellLabel: (column: number, row: number, disc: number) => string;
  readonly columnLabel: (
    column: number,
    occupied: number,
    full: boolean
  ) => string;
  readonly onDrop: (column: number) => void;
};
function landing(board: DiscDropBoardProps, column: number): number | null {
  for (let row = 0; row < board.rows; row++)
    if (board.cells[row * board.columns + column] === 0)
      return row * board.columns + column;
  return null;
}
function DiscCell(props: {
  board: DiscDropBoardProps;
  column: number;
  row: number;
  target: number | null;
}): JSX.Element {
  const index = () => props.row * props.board.columns + props.column;
  const disc = () => props.board.cells[index()] ?? 0;
  const marker = () =>
    disc() === 1
      ? '●'
      : disc() === 2
        ? '◆'
        : props.target === index()
          ? '↓'
          : '';
  return (
    <span
      class={styles['cell']}
      data-testid={`${props.board.testId}-cell-${index()}`}
      data-cell={index()}
      data-disc={disc()}
      data-preview={String(props.target === index())}
      data-preview-disc={props.target === index() ? props.board.active : 0}
      data-winning={String(props.board.winning.includes(index()))}
      data-last={String(props.board.lastCell === index() && disc() !== 0)}
      style={{ '--disc-distance': `${-(props.board.rows - props.row) * 100}%` }}
    >
      <span class={styles['disc']} aria-hidden="true">
        {marker()}
      </span>
    </span>
  );
}
function Column(props: {
  board: DiscDropBoardProps;
  column: number;
  target: number | null;
  preview: (column: number | null) => void;
  navigate: (event: KeyboardEvent, column: number) => void;
}): JSX.Element {
  const descriptionId = createUniqueId();
  const full = () => landing(props.board, props.column) === null;
  const rows = createMemo(() => {
    const count = props.board.rows;
    return Array.from({ length: count }, (_, n) => count - n - 1);
  });
  const occupied = () =>
    rows().filter(
      (row) => props.board.cells[row * props.board.columns + props.column] !== 0
    ).length;
  return (
    <>
      <button
        aria-describedby={descriptionId}
        type="button"
        class={styles['column']}
        data-column={props.column}
        data-testid={props.board.columnTestId(props.column)}
        aria-label={props.board.columnLabel(props.column, occupied(), full())}
        aria-disabled={!props.board.interactive || full()}
        data-full={String(full())}
        onPointerEnter={() => props.preview(props.column)}
        onPointerLeave={() => props.preview(null)}
        onFocus={() => props.preview(props.column)}
        onBlur={() => props.preview(null)}
        onKeyDown={(event) => props.navigate(event, props.column)}
        onClick={() => {
          if (props.board.interactive && !full())
            props.board.onDrop(props.column);
        }}
      >
        <span class={styles['number']} aria-hidden="true">
          {props.column + 1}
          <Show when={full()}> ×</Show>
        </span>
        <For each={rows()}>
          {(row) => (
            <DiscCell
              board={props.board}
              column={props.column}
              row={row}
              target={props.target}
            />
          )}
        </For>
      </button>
      <span id={descriptionId} class={styles['hidden']}>
        {rows()
          .map((row) =>
            props.board.cellLabel(
              props.column,
              row,
              props.board.cells[row * props.board.columns + props.column] ?? 0
            )
          )
          .join('. ')}
      </span>
    </>
  );
}
/** The native full-height column controls also work as practical touch targets. */
export function DiscDropBoard(props: DiscDropBoardProps): JSX.Element {
  const [preview, setPreview] = createSignal<number | null>(null);
  const columns = createMemo(() =>
    Array.from({ length: props.columns }, (_, n) => n)
  );
  const target = () => {
    const column = preview();
    return props.interactive && column !== null ? landing(props, column) : null;
  };
  let root: HTMLDivElement | undefined;
  const navigate = (event: KeyboardEvent, column: number): void => {
    const key = event.key;
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return;
    event.preventDefault();
    const next =
      key === 'Home'
        ? 0
        : key === 'End'
          ? props.columns - 1
          : (column + (key === 'ArrowRight' ? 1 : props.columns - 1)) %
            props.columns;
    root?.querySelector<HTMLButtonElement>(`[data-column="${next}"]`)?.focus();
  };
  return (
    <div
      ref={root}
      class={styles['board']}
      {...dataAttrs({ component: 'DiscDropBoard' })}
      role="group"
      aria-label={props.label}
      data-testid={props.testId}
      data-preview-cell={target() ?? -1}
      data-cells={JSON.stringify(props.cells)}
      style={{ '--disc-columns': props.columns }}
    >
      <For each={columns()}>
        {(column) => (
          <Column
            board={props}
            column={column}
            target={target()}
            preview={setPreview}
            navigate={navigate}
          />
        )}
      </For>
    </div>
  );
}
