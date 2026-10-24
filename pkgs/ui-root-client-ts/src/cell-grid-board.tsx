import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, createSignal, For, type JSX } from 'solid-js';
import styles from './cell-grid-board.module.css';

/**
 * How a cell reads at a glance. Every tone also differs by its glyph and its
 * label, so colour never carries a state alone.
 */
export type CellGridTone = 'open' | 'occupied' | 'quiet' | 'alert' | 'critical';
/** A transient ring over the tone: the latest change, a pending choice, a preview. */
export type CellGridEmphasis =
  | 'none'
  | 'recent'
  | 'pending'
  | 'preview'
  | 'refused';
export type CellGridEdge = 'top' | 'right' | 'bottom' | 'left';
export type CellGridCell = {
  readonly id: string;
  /** Shown in the cell; hidden from assistive technology (the label says it). */
  readonly glyph: string;
  /** The cell's whole accessible name: where it is and what it holds. */
  readonly label: string;
  readonly tone: CellGridTone;
  readonly emphasis?: CellGridEmphasis | undefined;
  /** Drawn with a heavy ring: part of a finished group. */
  readonly outlined?: boolean | undefined;
  /** Whether activating it does anything. */
  readonly enabled: boolean;
  /** Boundaries between cells; consecutive edges form a continuous barrier. */
  readonly edges?: readonly CellGridEdge[] | undefined;
  readonly previewEdges?: readonly CellGridEdge[] | undefined;
  /** Four visual identities, also named by the cell's label and glyph. */
  readonly identity?: 'one' | 'two' | 'three' | 'four' | undefined;
};
export type CellGridBoardProps = {
  readonly label: string;
  readonly testId: string;
  readonly columnLabels: readonly string[];
  readonly rowLabels: readonly string[];
  /** Row-major, one per column and row. */
  readonly cells: readonly CellGridCell[];
  /** Defaults to `${testId}-cell-${id}`. */
  readonly cellTestId?: ((id: string) => string) | undefined;
  readonly onActivate?: ((id: string) => void) | undefined;
  /** The cell under the pointer or focus, `null` when it leaves. */
  readonly onPreview?: ((id: string | null) => void) | undefined;
  /** A key the grid does not use itself; `true` when it was handled. */
  readonly onCellKey?: ((key: string, id: string) => boolean) | undefined;
  readonly describedBy?: string | undefined;
};
export type CellGridSize = {
  readonly columns: number;
  readonly rows: number;
};

/** The cell a navigation key moves to from `index`, or `null` for any other key. */
export function cellGridStep(
  event: Pick<KeyboardEvent, 'key' | 'ctrlKey' | 'metaKey'>,
  index: number,
  size: CellGridSize
): number | null {
  const column = index % size.columns;
  const row = Math.floor(index / size.columns);
  const at = (c: number, r: number): number =>
    Math.min(size.rows - 1, Math.max(0, r)) * size.columns +
    Math.min(size.columns - 1, Math.max(0, c));
  const corner = event.ctrlKey || event.metaKey;
  const steps: Readonly<Record<string, () => number>> = {
    ArrowLeft: () => at(column - 1, row),
    ArrowRight: () => at(column + 1, row),
    ArrowUp: () => at(column, row - 1),
    ArrowDown: () => at(column, row + 1),
    Home: () => (corner ? 0 : at(0, row)),
    End: () => (corner ? size.columns * size.rows - 1 : at(size.columns, row)),
  };
  return steps[event.key]?.() ?? null;
}

function GridCell(props: {
  board: CellGridBoardProps;
  index: number;
  focusable: boolean;
  onFocusIndex: (index: number) => void;
  onKey: (event: KeyboardEvent, index: number) => void;
}): JSX.Element {
  const cell = () => props.board.cells[props.index];
  const id = () => cell()?.id ?? '';
  return (
    <button
      type="button"
      class={styles['cell']}
      data-index={props.index}
      data-cell={id()}
      data-testid={
        props.board.cellTestId?.(id()) ?? `${props.board.testId}-cell-${id()}`
      }
      data-tone={cell()?.tone ?? 'open'}
      data-emphasis={cell()?.emphasis ?? 'none'}
      data-outlined={String(cell()?.outlined === true)}
      data-identity={cell()?.identity}
      data-edge-top={String(cell()?.edges?.includes('top') === true)}
      data-edge-right={String(cell()?.edges?.includes('right') === true)}
      data-edge-bottom={String(cell()?.edges?.includes('bottom') === true)}
      data-edge-left={String(cell()?.edges?.includes('left') === true)}
      data-preview-edge-top={String(
        cell()?.previewEdges?.includes('top') === true
      )}
      data-preview-edge-right={String(
        cell()?.previewEdges?.includes('right') === true
      )}
      data-preview-edge-bottom={String(
        cell()?.previewEdges?.includes('bottom') === true
      )}
      data-preview-edge-left={String(
        cell()?.previewEdges?.includes('left') === true
      )}
      aria-label={cell()?.label}
      aria-disabled={cell()?.enabled !== true}
      tabIndex={props.focusable ? 0 : -1}
      onFocus={() => {
        props.onFocusIndex(props.index);
        props.board.onPreview?.(id());
      }}
      onBlur={() => props.board.onPreview?.(null)}
      onPointerEnter={() => props.board.onPreview?.(id())}
      onPointerLeave={() => props.board.onPreview?.(null)}
      onKeyDown={(event) => props.onKey(event, props.index)}
      onClick={() => {
        if (cell()?.enabled === true) props.board.onActivate?.(id());
      }}
    >
      <span class={styles['glyph']} aria-hidden="true">
        {cell()?.glyph ?? ''}
      </span>
    </button>
  );
}

function range(count: number): readonly number[] {
  return Array.from({ length: count }, (_, n) => n);
}

function Header(props: { label: string }): JSX.Element {
  return (
    <span class={styles['header']} aria-hidden="true">
      {props.label}
    </span>
  );
}

/**
 * A labelled square grid of cell buttons under column and row headers. One
 * cell is the tab stop; arrow keys move between cells, Home / End to a row's
 * ends (with Ctrl or Cmd, the grid's), Enter or Space activates. Cells stay
 * mounted as their content changes, so focus survives every update.
 */
export function CellGridBoard(props: CellGridBoardProps): JSX.Element {
  const [focusIndex, setFocusIndex] = createSignal(0);
  // Numbers, not objects: a new label array never remounts a cell.
  const rows = createMemo(() => range(props.rowLabels.length));
  const columns = createMemo(() => range(props.columnLabels.length));
  let root: HTMLDivElement | undefined;
  const onKey = (event: KeyboardEvent, index: number): void => {
    const size = {
      columns: props.columnLabels.length,
      rows: props.rowLabels.length,
    };
    const next = cellGridStep(event, index, size);
    if (next !== null) {
      event.preventDefault();
      setFocusIndex(next);
      root?.querySelector<HTMLButtonElement>(`[data-index="${next}"]`)?.focus();
      return;
    }
    const id = props.cells[index]?.id;
    if (id !== undefined && props.onCellKey?.(event.key, id) === true)
      event.preventDefault();
  };
  return (
    <div
      ref={root}
      class={styles['board']}
      {...dataAttrs({ component: 'CellGridBoard' })}
      role="group"
      aria-label={props.label}
      aria-describedby={props.describedBy}
      data-testid={props.testId}
      style={{ '--cell-grid-columns': props.columnLabels.length }}
    >
      <span class={styles['header']} aria-hidden="true" />
      <For each={props.columnLabels}>{(label) => <Header label={label} />}</For>
      <For each={rows()}>
        {(row) => (
          <>
            <Header label={props.rowLabels[row] ?? ''} />
            <For each={columns()}>
              {(column) => (
                <GridCell
                  board={props}
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
