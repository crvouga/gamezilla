import { t } from '@lingui/core/macro';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  createEffect,
  createMemo,
  createSignal,
  type JSX,
  onCleanup,
  Show,
  untrack,
} from 'solid-js';
import { cellGridStep } from '../cell-grid-board/index';
import { createMediaQuery } from '../media-query';
import { observeElementResize } from '../observe-element-resize';
import { StackVertical } from '../stack/index';
import { P } from '../text/index';
import styles from './word-tile-board.module.css';
import { BoardRows } from './word-tile-cell';
import { WordTileOverview } from './word-tile-overview';
import { WordTileViewControls } from './word-tile-view-controls';

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

function sameCell(a: WordTileBoardCell, b: WordTileBoardCell): boolean {
  return (
    a.id === b.id &&
    a.letter === b.letter &&
    a.points === b.points &&
    a.square === b.square &&
    a.state === b.state &&
    a.label === b.label &&
    a.enabled === b.enabled
  );
}

/** The next cells, keeping each previous object whose fields did not change. */
export function reuseUnchangedCells(
  previous: readonly WordTileBoardCell[],
  next: readonly WordTileBoardCell[]
): readonly WordTileBoardCell[] {
  let changed = previous.length !== next.length;
  const kept = next.map((cell, index) => {
    const before = previous[index];
    if (before !== undefined && sameCell(before, cell)) return before;
    changed = true;
    return cell;
  });
  return changed ? kept : previous;
}

/** The board's middle square, the tab stop until a square is chosen. */
function centreIndex(
  board: Pick<WordTileBoardProps, 'rowLabels' | 'columnLabels'>
): number {
  return (
    Math.floor(board.rowLabels.length / 2) * board.columnLabels.length +
    Math.floor(board.columnLabels.length / 2)
  );
}

/**
 * Read once per change: every square reads the list, and a caller that
 * computes it inline would otherwise rebuild it once per square. Unchanged
 * squares keep their previous object, so only changed squares update.
 */
function createStableCells(
  read: () => readonly WordTileBoardCell[]
): () => readonly WordTileBoardCell[] {
  return createMemo<readonly WordTileBoardCell[]>(
    (previous) => reuseUnchangedCells(previous, read()),
    []
  );
}

export type WordTileBoardProps = {
  /** Locator mode shows the whole board; activation chooses a location, never a move. */
  readonly purpose?: 'placement' | 'locator';
  /** Compact fitted board leaves room for rack and puzzle actions; enlarged cells stay full size. */
  readonly measure?: 'full' | 'compact';
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

function focusCell(root: HTMLDivElement | undefined, index: number): void {
  const cell = root?.querySelector<HTMLButtonElement>(
    `[data-index="${index}"]`
  );
  cell?.focus();
  // The overview narrows the viewport. Reveal the whole cell after layout,
  // retaining the sticky coordinate clearance declared by the board.
  cell?.scrollIntoView({
    block: 'nearest',
    inline: 'nearest',
    behavior: 'instant',
  });
}

function boardKeyboard(
  board: WordTileBoardProps,
  onFocus: (index: number) => void
): (event: KeyboardEvent, index: number) => void {
  return (event, index) => {
    const next = cellGridStep(event, index, {
      columns: board.columnLabels.length,
      rows: board.rowLabels.length,
    });
    if (next === null) return;
    event.preventDefault();
    onFocus(next);
  };
}

function createPrecisionCenter(
  viewport: () => HTMLDivElement | undefined,
  root: () => HTMLDivElement | undefined,
  enlarged: () => boolean,
  focusIndex: () => number
): () => void {
  const center = () => {
    const element = viewport();
    if (!element || !enlarged()) return;
    const cell = root()?.querySelector<HTMLElement>(
      `[data-index="${focusIndex()}"]`
    );
    if (!cell) return;
    const bounds = cell.getBoundingClientRect();
    const clip = element.getBoundingClientRect();
    element.scrollLeft +=
      bounds.left - clip.left - (clip.width - bounds.width) / 2;
    element.scrollTop +=
      bounds.top - clip.top - (clip.height - bounds.height) / 2;
  };
  createEffect(() => {
    const element = viewport();
    if (!element || !enlarged()) return;
    // Center on zoom or resize, never when a pointer focuses a visible cell.
    // Moving that cell between press and release can change the hit target.
    untrack(center);
    onCleanup(observeElementResize(element, center));
  });
  return center;
}

/**
 * A word-game board: a labelled grid of square buttons under column and row
 * headers. Empty squares print their bonus; tiles show their letter and
 * value, a tentative tile dashed and a last-turn tile ringed (each also in
 * its label, so colour never carries a state alone). One cell is the tab
 * stop; arrow keys move, Home / End go to a row's ends, Enter or Space
 * activates. Phones start with precision cells and a whole-board region navigator;
 * wider screens start fitted. An explicit view choice persists across resizing.
 */
export function WordTileBoard(props: WordTileBoardProps): JSX.Element {
  const [selectedIndex, setFocusIndex] = createSignal<number>();
  const focusIndex = () => selectedIndex() ?? centreIndex(props);
  const compact = createMediaQuery('(max-width: 639px)');
  const [choice, setEnlarged] = createSignal<boolean>();
  const enlarged = () => props.purpose !== 'locator' && (choice() ?? compact());
  const cells = createStableCells(() => props.cells);
  let root: HTMLDivElement | undefined;
  const [viewport, setViewport] = createSignal<HTMLDivElement>();
  const center = createPrecisionCenter(
    viewport,
    () => root,
    enlarged,
    focusIndex
  );
  const onKey = boardKeyboard(props, (next) => {
    setFocusIndex(next);
    focusCell(root, next);
  });
  const resize = (value: boolean): void => {
    setEnlarged(value);
    focusCell(root, focusIndex());
  };
  return (
    <StackVertical gap="none">
      {/* Wider than a phone, Fit and Enlarge stay in one place in both views. */}
      <Show when={props.purpose !== 'locator' && (!enlarged() || !compact())}>
        <WordTileViewControls enlarged={enlarged()} onChange={resize} />
      </Show>
      <Show when={props.purpose === 'locator'}>
        <P role="status">{cells()[focusIndex()]?.label}</P>
      </Show>
      <div class={styles['precision']}>
        <div
          ref={setViewport}
          class={styles['viewport']}
          data-enlarged={enlarged()}
          data-measure={props.measure ?? 'full'}
          role="region"
          aria-label={t`Scrollable word board`}
        >
          <div
            ref={root}
            class={styles['board']}
            data-measure={props.measure ?? 'full'}
            data-enlarged={enlarged()}
            {...dataAttrs({ component: 'WordTileBoard' })}
            role="group"
            aria-label={props.label}
            aria-describedby={props.describedBy}
            data-testid={props.testId}
            style={{ '--word-tile-columns': props.columnLabels.length }}
          >
            <BoardRows
              board={props}
              cells={cells}
              focusIndex={focusIndex}
              onFocusIndex={setFocusIndex}
              onKey={onKey}
            />
          </div>
        </div>
        <Show when={enlarged()}>
          <WordTileOverview
            board={props}
            cells={cells}
            viewport={viewport}
            controls={
              compact() ? (
                <WordTileViewControls enlarged={enlarged()} onChange={resize} />
              ) : undefined
            }
            position={cells()[focusIndex()]?.label ?? ''}
            locator={(onChoose) => (
              <WordTileBoard
                {...props}
                purpose="locator"
                testId={`${props.testId}-map`}
                label={t`Whole board locator`}
                cells={cells().map((cell) => ({ ...cell, enabled: true }))}
                onActivate={onChoose}
              />
            )}
            onLocate={(id) => {
              const index = cells().findIndex((cell) => cell.id === id);
              if (index < 0) return;
              setFocusIndex(index);
              focusCell(root, index);
              center();
            }}
          />
        </Show>
      </div>
      <Show when={props.purpose !== 'locator' && !enlarged()}>
        <P variant="caption" testId={`${props.testId}-square-details`}>
          {cells()[focusIndex()]?.label}
        </P>
      </Show>
    </StackVertical>
  );
}
