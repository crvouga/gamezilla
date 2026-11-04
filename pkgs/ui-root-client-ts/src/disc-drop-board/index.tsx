import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  createMemo,
  createSignal,
  createUniqueId,
  For,
  type JSX,
  Show,
} from 'solid-js';
import { useGameBoardPreview } from '../game-board-stage/board-preview';
import { ChevronDownIcon } from '../icons';
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
  /**
   * One line above the columns saying what to do while the board takes a
   * drop (`Choose a column`); `''` while someone else is to move, so the
   * line (and the chevrons' band) keeps its height and the board never
   * moves when the turn changes. Leave it out when nobody is to move (the
   * game is over): then neither the line nor the chevrons' band is drawn.
   */
  readonly prompt?: string | undefined;
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
  // The landing cell of the column pointed at holds the dropping side's
  // ghost disc, its mark included.
  const marker = () =>
    disc() !== 0
      ? discMark(disc())
      : props.target === index()
        ? discMark(props.board.active)
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
/** The disc each side drops: its mark, inside its fill. */
function discMark(disc: number): string {
  return disc === 1 ? '●' : disc === 2 ? '◆' : '';
}

/**
 * Above a column: its number, as the record writes its moves (counted from
 * 1), and while the board takes a drop a chevron under it over every open
 * column, in the dropping side's color over the one pointed at or focused
 * (whose landing cell holds that side's ghost disc). While someone is to
 * move the chevron's band keeps its height when empty; a board nobody is
 * to move on draws only the numbers. A preview draws neither.
 */
function DropMarker(props: {
  board: DiscDropBoardProps;
  column: number;
  previewed: boolean;
  full: boolean;
}): JSX.Element {
  const turnTaken = (): boolean => props.board.prompt !== undefined;
  return (
    <span
      class={styles['drop']}
      data-disc={props.previewed ? props.board.active : 0}
      aria-hidden="true"
    >
      <span class={`${styles['number']} text textCaption`}>
        {props.column + 1}
      </span>
      <Show when={turnTaken()}>
        <span class={styles['chevron']}>
          <Show when={props.board.interactive && !props.full}>
            <ChevronDownIcon size={16} />
          </Show>
        </span>
      </Show>
    </span>
  );
}

function Column(props: {
  board: DiscDropBoardProps;
  column: number;
  /** Drawn as a `GameBoardStage` preview: the discs alone. */
  thumbnail: boolean;
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
  const previewed = () =>
    props.target !== null &&
    props.target % props.board.columns === props.column;
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
        <Show when={!props.thumbnail}>
          <DropMarker
            board={props.board}
            column={props.column}
            previewed={previewed()}
            full={full()}
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
/**
 * A board of columns a disc drops down. Each column is one native,
 * full-height button (also a practical touch target) headed by its number;
 * a prompt line above them says what to do, and while the board takes a
 * drop each open column carries a chevron, the one pointed at or focused in
 * the dropping side's color, with that side's ghost disc in the cell where
 * it would land. As a `GameBoardStage` preview (a game still being set up)
 * it draws only its discs: no prompt line, numbers or chevrons.
 */
export function DiscDropBoard(props: DiscDropBoardProps): JSX.Element {
  const promptId = createUniqueId();
  const thumbnail = useGameBoardPreview();
  const prompting = (): boolean => (props.prompt ?? '').length > 0;
  // The prompt's line is drawn while someone is to move, never on a preview.
  const promptLine = (): boolean => props.prompt !== undefined && !thumbnail();
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
      aria-describedby={prompting() && promptLine() ? promptId : undefined}
      data-testid={props.testId}
      data-preview-cell={target() ?? -1}
      data-cells={JSON.stringify(props.cells)}
      style={{ '--disc-columns': props.columns }}
    >
      <Show when={promptLine()}>
        <p
          id={promptId}
          class={`${styles['prompt']} text textCaption`}
          data-testid={`${props.testId}-prompt`}
        >
          {props.prompt ?? ''}
        </p>
      </Show>
      <For each={columns()}>
        {(column) => (
          <Column
            board={props}
            column={column}
            thumbnail={thumbnail()}
            target={target()}
            preview={setPreview}
            navigate={navigate}
          />
        )}
      </For>
    </div>
  );
}
