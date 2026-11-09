import { createMemo, createUniqueId, For, type JSX, Show } from 'solid-js';
import styles from './disc-drop-board.module.css';
import type { DiscDropBoardProps } from './index';

export function landing(
  board: DiscDropBoardProps,
  column: number
): number | null {
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
  // A played disc carries its side's mark; the landing preview never does
  // (a dashed, empty outline), so it can never be read as a disc played.
  const marker = () => (disc() !== 0 ? discMark(disc()) : '');
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
/** The disc each side drops: its mark, inside its fill. */
function discMark(disc: number): string {
  return disc === 1 ? '●' : disc === 2 ? '◆' : '';
}

/**
 * Above a column: its number, as the record writes its moves (counted from
 * 1). The column pointed at or focused rings its number in the dropping
 * side's colour (a hollow disc in the drop slot), over the column's tint
 * and the dashed outline where it would land. A preview draws no numbers.
 */
function DropMarker(props: {
  board: DiscDropBoardProps;
  column: number;
  previewed: boolean;
}): JSX.Element {
  return (
    <span
      class={styles['drop']}
      data-disc={props.previewed ? props.board.active : 0}
      aria-hidden="true"
    >
      <span class={`${styles['number']} text textCaption`}>
        {props.column + 1}
      </span>
    </span>
  );
}

export function Column(props: {
  board: DiscDropBoardProps;
  column: number;
  /** Drawn as a `GameBoardStage` preview: the discs alone. */
  thumbnail: boolean;
  /** The board's single Tab stop; the other columns are reached by arrows. */
  tabStop: boolean;
  target: number | null;
  preview: (column: number | null) => void;
  focus: (column: number | null) => void;
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
  const previewed = () =>
    props.target !== null &&
    props.target % props.board.columns === props.column;
  return (
    <>
      <button
        aria-describedby={descriptionId}
        tabIndex={props.tabStop ? 0 : -1}
        aria-keyshortcuts={
          props.board.interactive
            ? 'ArrowLeft ArrowRight Home End Enter Space'
            : 'ArrowLeft ArrowRight Home End'
        }
        type="button"
        class={styles['column']}
        data-column={props.column}
        data-testid={props.board.columnTestId(props.column)}
        aria-label={props.board.columnLabel(props.column, occupied(), full())}
        aria-disabled={!props.board.interactive || full()}
        data-full={String(full())}
        data-previewed={String(previewed())}
        onPointerEnter={() => props.preview(props.column)}
        onPointerLeave={() => props.preview(null)}
        onPointerCancel={() => props.preview(null)}
        onFocus={() => props.focus(props.column)}
        onBlur={() => props.focus(null)}
        onKeyDown={(event) => props.navigate(event, props.column)}
        onClick={() => {
          if (props.board.interactive && !full())
            props.board.onDrop(props.column);
        }}
      >
        <Show when={!props.thumbnail}>
          <DropMarker
            board={props.board}
            column={props.column}
            previewed={previewed()}
          />
        </Show>
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

export function nextColumn(
  key: string,
  column: number,
  count: number
): number | null {
  if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key)) return null;
  return key === 'Home'
    ? 0
    : key === 'End'
      ? count - 1
      : (column + (key === 'ArrowRight' ? 1 : count - 1)) % count;
}
