import { t } from '@lingui/core/macro';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from '@solidjs/web';
import {
  createEffect,
  createMemo,
  createSignal,
  onSettled,
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
import { WordTileViewMenu } from './word-tile-view-menu';

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
  return createMemo<readonly WordTileBoardCell[]>((previous) =>
    reuseUnchangedCells(previous ?? [], read())
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

/** Focus a cell once the view it is about to be drawn in has settled. */
function focusCellWhenSettled(
  root: () => HTMLDivElement | undefined,
  index: number
): void {
  onSettled(() => focusCell(root(), index));
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
): (index?: number) => void {
  // A caller that has just chosen a cell names it: the choice is not yet
  // readable from `focusIndex`.
  const center = (index: number = focusIndex()): void => {
    const element = viewport();
    if (!element || !enlarged()) return;
    const cell = root()?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    if (!cell) return;
    const bounds = cell.getBoundingClientRect();
    const clip = element.getBoundingClientRect();
    element.scrollLeft +=
      bounds.left - clip.left - (clip.width - bounds.width) / 2;
    element.scrollTop +=
      bounds.top - clip.top - (clip.height - bounds.height) / 2;
  };
  // Center on zoom or resize, never when a pointer focuses a visible cell.
  // Moving that cell between press and release can change the hit target.
  createEffect(
    () => (enlarged() ? viewport() : undefined),
    (element) => {
      if (!element) return undefined;
      // The focused cell as it is now: a later focus move does not re-center.
      untrack(center);
      return observeElementResize(element, () => center());
    }
  );
  return center;
}

/** What a board's view tools read and do. */
type BoardView = {
  readonly compact: () => boolean;
  readonly enlarged: () => boolean;
  readonly cells: () => readonly WordTileBoardCell[];
  readonly viewport: () => HTMLDivElement | undefined;
  /** The chosen square's whole name, for its details readout. */
  readonly label: () => string;
  readonly resize: (enlarged: boolean) => void;
  readonly locate: (id: string) => void;
};

/** The enlarged board's overview; Find a square opens the whole-board locator. */
function BoardOverview(props: {
  board: WordTileBoardProps;
  view: BoardView;
  position?: string | undefined;
}): JSX.Element {
  return (
    <WordTileOverview
      board={props.board}
      cells={props.view.cells}
      viewport={props.view.viewport}
      position={props.position}
      locator={(onChoose) => (
        <WordTileBoard
          {...props.board}
          purpose="locator"
          testId={`${props.board.testId}-map`}
          label={t`Whole board locator`}
          cells={props.view.cells().map((cell) => ({ ...cell, enabled: true }))}
          onActivate={onChoose}
        />
      )}
      onLocate={props.view.locate}
    />
  );
}

/** A phone's View button and dialog: Fit, Enlarge and, enlarged, the overview. */
function BoardViewMenu(props: {
  board: WordTileBoardProps;
  view: BoardView;
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}): JSX.Element {
  return (
    <WordTileViewMenu
      testId={props.board.testId}
      position={props.view.label()}
      open={props.open}
      onOpen={props.onOpen}
      onClose={props.onClose}
    >
      <StackVertical gap="md">
        <WordTileViewControls
          enlarged={props.view.enlarged()}
          onChange={props.view.resize}
        />
        <Show
          when={props.view.enlarged()}
          fallback={
            <P variant="caption">{t`Enlarge the board to move around it by area or find a square.`}</P>
          }
        >
          <BoardOverview board={props.board} view={props.view} />
        </Show>
      </StackVertical>
    </WordTileViewMenu>
  );
}

/**
 * The board's view state: fitted or enlarged, the chosen square, and on a
 * phone whether its View dialog is open. A view choice made in that dialog
 * closes it, and the square moves once it has let go of focus.
 */
function createBoardView(props: WordTileBoardProps) {
  const [selectedIndex, setFocusIndex] = createSignal<number>();
  const focusIndex = () => selectedIndex() ?? centreIndex(props);
  const compact = createMediaQuery('(max-width: 639px)');
  const [choice, setEnlarged] = createSignal<boolean>();
  const enlarged = () => props.purpose !== 'locator' && (choice() ?? compact());
  const [viewing, setViewing] = createSignal(false);
  const cells = createStableCells(() => props.cells);
  // The board element, set once by its ref: not reactive.
  let element: HTMLDivElement | undefined;
  const root = (): HTMLDivElement | undefined => element;
  const setRoot = (value: HTMLDivElement): void => {
    element = value;
  };
  const [viewport, setViewport] = createSignal<HTMLDivElement>();
  const center = createPrecisionCenter(viewport, root, enlarged, focusIndex);
  const show = (index: number): void => {
    setFocusIndex(index);
    focusCell(root(), index);
    center(index);
  };
  const view: BoardView = {
    compact,
    enlarged,
    cells,
    viewport,
    label: () => cells()[focusIndex()]?.label ?? '',
    resize: (value) => {
      setViewing(false);
      setEnlarged(value);
      focusCellWhenSettled(root, focusIndex());
    },
    locate: (id) => {
      const index = cells().findIndex((cell) => cell.id === id);
      if (index < 0) return;
      if (!viewing()) {
        show(index);
        return;
      }
      setViewing(false);
      onSettled(() => show(index));
    },
  };
  const onKey = boardKeyboard(props, (next) => {
    setFocusIndex(next);
    focusCell(element, next);
  });
  return {
    view,
    focusIndex,
    setFocusIndex,
    setRoot,
    setViewport,
    viewing,
    setViewing,
    onKey,
  };
}

/**
 * A word-game board: a labelled grid of square buttons under column and row
 * headers. Empty squares print their bonus; tiles show their letter and
 * value, a tentative tile dashed and a last-turn tile ringed (each also in
 * its label, so colour never carries a state alone). One cell is the tab
 * stop; arrow keys move, Home / End go to a row's ends, Enter or Space
 * activates. Phones start with precision cells, and keep Fit, Enlarge and a
 * whole-board region navigator behind one View button under the board;
 * wider screens start fitted, with Fit and Enlarge beside the board. An
 * explicit view choice persists across resizing.
 */
export function WordTileBoard(props: WordTileBoardProps): JSX.Element {
  const state = createBoardView(props);
  const { view } = state;
  const placement = () => props.purpose !== 'locator';
  const measure = () => props.measure ?? 'full';
  return (
    <StackVertical gap="none">
      {/* Wider than a phone, Fit and Enlarge stay in one place in both views. */}
      <Show when={placement() && !view.compact()}>
        <WordTileViewControls
          enlarged={view.enlarged()}
          onChange={view.resize}
        />
      </Show>
      <Show when={!placement()}>
        <P role="status">{view.label()}</P>
      </Show>
      <div
        class={styles['precision']}
        data-view-menu={String(placement() && view.compact())}
      >
        <div
          ref={state.setViewport}
          class={styles['viewport']}
          data-enlarged={String(view.enlarged())}
          data-measure={measure()}
          role="region"
          aria-label={t`Scrollable word board`}
        >
          <div
            ref={state.setRoot}
            class={styles['board']}
            data-measure={measure()}
            data-enlarged={String(view.enlarged())}
            role="group"
            aria-label={props.label}
            aria-describedby={props.describedBy}
            data-testid={props.testId}
            {...dataAttrs({ component: 'WordTileBoard' })}
            style={{ '--word-tile-columns': props.columnLabels.length }}
          >
            <BoardRows
              board={props}
              cells={view.cells}
              focusIndex={state.focusIndex}
              onFocusIndex={state.setFocusIndex}
              onKey={state.onKey}
            />
          </div>
        </div>
        <Show when={view.enlarged() && !view.compact()}>
          <BoardOverview board={props} view={view} position={view.label()} />
        </Show>
      </div>
      <Show when={placement() && view.compact()}>
        <BoardViewMenu
          board={props}
          view={view}
          open={state.viewing()}
          onOpen={() => state.setViewing(true)}
          onClose={() => state.setViewing(false)}
        />
      </Show>
      <Show when={placement() && !view.compact() && !view.enlarged()}>
        <P variant="caption" testId={`${props.testId}-square-details`}>
          {view.label()}
        </P>
      </Show>
    </StackVertical>
  );
}
