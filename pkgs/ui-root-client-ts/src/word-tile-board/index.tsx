import { t } from '@lingui/core/macro';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, createSignal, type JSX, Show } from 'solid-js';
import { cellGridStep } from '../cell-grid-board/index';
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

/**
 * A word-game board: a labelled grid of square buttons under column and row
 * headers. Empty squares print their bonus; tiles show their letter and
 * value, a tentative tile dashed and a last-turn tile ringed (each also in
 * its label, so colour never carries a state alone). One cell is the tab
 * stop; arrow keys move, Home / End go to a row's ends, Enter or Space
 * activates. It fits its container, shrinking its squares on small screens.
 */
export function WordTileBoard(props: WordTileBoardProps): JSX.Element {
  const [selectedIndex, setFocusIndex] = createSignal<number>();
  const focusIndex = () =>
    selectedIndex() ??
    Math.floor(props.rowLabels.length / 2) * props.columnLabels.length +
      Math.floor(props.columnLabels.length / 2);
  const [enlarged, setEnlarged] = createSignal(false);
  // Read once per change: every square reads the list, and a caller that
  // computes it inline would otherwise rebuild it once per square.
  const cells = createMemo(() => props.cells);
  let root: HTMLDivElement | undefined;
  const [viewport, setViewport] = createSignal<HTMLDivElement>();
  const onKey = (event: KeyboardEvent, index: number): void => {
    const next = cellGridStep(event, index, {
      columns: props.columnLabels.length,
      rows: props.rowLabels.length,
    });
    if (next === null) return;
    event.preventDefault();
    setFocusIndex(next);
    focusCell(root, next);
  };
  const resize = (value: boolean): void => {
    setEnlarged(value);
    focusCell(root, focusIndex());
  };
  return (
    <StackVertical gap="xs">
      <Show when={props.purpose !== 'locator'}>
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
            viewport={viewport}
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
            }}
          />
        </Show>
      </div>
    </StackVertical>
  );
}
