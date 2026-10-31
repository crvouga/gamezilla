import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, createSignal, For, type JSX, Show } from 'solid-js';
import { cellGridStep } from '../cell-grid-board/index';
import styles from './word-tile-board.module.css';

/** A square's printed bonus: letter or word, doubled or tripled, or the start. */
export type WordTileSquare = 'DL' | 'TL' | 'DW' | 'TW' | 'start';
/**
 * What a cell holds: nothing, a committed tile, a tentative tile of the
 * viewer's candidate (never anyone else's), or a tile committed last turn.
 */
export type WordTileCellState = 'empty' | 'committed' | 'tentative' | 'recent';

export type WordTileBoardCell = {
  readonly id: string;
  /** The letter shown, `''` for an empty cell. */
  readonly letter: string;
  /** The tile's value, `null` for an empty cell; a blank shows `0`. */
  readonly points: number | null;
  readonly square: WordTileSquare | null;
  readonly state: WordTileCellState;
  /**
   * The cell's whole accessible name, starting with what it shows (`C 3`, or
   * the square's printed name `3W`), then where it is and its state.
   */
  readonly label: string;
  readonly enabled: boolean;
};

export type WordTileBoardProps = {
  readonly label: string;
  readonly testId: string;
  readonly columnLabels: readonly string[];
  readonly rowLabels: readonly string[];
  /** Row-major, one per column and row. */
  readonly cells: readonly WordTileBoardCell[];
  /** Short printed names of the squares (`2L`, `3W`, `★`). */
  readonly squareText: (square: WordTileSquare) => string;
  readonly onActivate?: ((id: string) => void) | undefined;
  readonly describedBy?: string | undefined;
};

function BoardCell(props: {
  board: WordTileBoardProps;
  cells: () => readonly WordTileBoardCell[];
  index: number;
  focusable: boolean;
  onFocusIndex: (index: number) => void;
  onKey: (event: KeyboardEvent, index: number) => void;
}): JSX.Element {
  const cell = () => props.cells()[props.index];
  return (
    <button
      type="button"
      class={styles['cell']}
      data-index={props.index}
      data-cell={cell()?.id}
      data-testid={`${props.board.testId}-cell-${cell()?.id ?? ''}`}
      data-state={cell()?.state ?? 'empty'}
      data-square={cell()?.square ?? 'none'}
      aria-label={cell()?.label}
      aria-disabled={cell()?.enabled !== true}
      tabIndex={props.focusable ? 0 : -1}
      onFocus={() => props.onFocusIndex(props.index)}
      onKeyDown={(event) => props.onKey(event, props.index)}
      onClick={() => {
        const id = cell()?.id;
        if (id !== undefined && cell()?.enabled === true)
          props.board.onActivate?.(id);
      }}
    >
      <Show
        when={cell()?.letter}
        fallback={
          <span class={styles['square']} aria-hidden="true">
            <Show when={cell()?.square}>
              {(square) => props.board.squareText(square())}
            </Show>
          </span>
        }
      >
        <span class={styles['letter']} aria-hidden="true">
          {cell()?.letter}
        </span>{' '}
        <span class={styles['points']} aria-hidden="true">
          {cell()?.points ?? ''}
        </span>
      </Show>
    </button>
  );
}

function range(count: number): readonly number[] {
  return Array.from({ length: count }, (_, n) => n);
}

/**
 * A word-game board: a labelled grid of square buttons under column and row
 * headers. Empty squares print their bonus; tiles show their letter and
 * value, a tentative tile dashed and a last-turn tile ringed (each also in
 * its label, so colour never carries a state alone). One cell is the tab
 * stop; arrow keys move, Home / End go to a row's ends, Enter or Space
 * activates. It fits its container, shrinking its squares on small screens.
 */
export function WordTileBoard(props: WordTileBoardProps): JSX.Element {
  const [focusIndex, setFocusIndex] = createSignal(112);
  // Read once per change: every square reads the list, and a caller that
  // computes it inline would otherwise rebuild it once per square.
  const cells = createMemo(() => props.cells);
  const rows = createMemo(() => range(props.rowLabels.length));
  const columns = createMemo(() => range(props.columnLabels.length));
  let root: HTMLDivElement | undefined;
  const onKey = (event: KeyboardEvent, index: number): void => {
    const next = cellGridStep(event, index, {
      columns: props.columnLabels.length,
      rows: props.rowLabels.length,
    });
    if (next === null) return;
    event.preventDefault();
    setFocusIndex(next);
    root?.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus();
  };
  return (
    <div
      ref={root}
      class={styles['board']}
      {...dataAttrs({ component: 'WordTileBoard' })}
      role="group"
      aria-label={props.label}
      aria-describedby={props.describedBy}
      data-testid={props.testId}
      style={{ '--word-tile-columns': props.columnLabels.length }}
    >
      <span class={styles['header']} aria-hidden="true" />
      <For each={props.columnLabels}>
        {(label) => (
          <span class={styles['header']} aria-hidden="true">
            {label}
          </span>
        )}
      </For>
      <For each={rows()}>
        {(row) => (
          <>
            <span class={styles['header']} aria-hidden="true">
              {props.rowLabels[row] ?? ''}
            </span>
            <For each={columns()}>
              {(column) => (
                <BoardCell
                  board={props}
                  cells={cells}
                  index={row * columns().length + column}
                  focusable={focusIndex() === row * columns().length + column}
                  onFocusIndex={setFocusIndex}
                  onKey={onKey}
                />
              )}
            </For>
          </>
        )}
      </For>
    </div>
  );
}
