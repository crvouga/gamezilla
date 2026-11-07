import { For, type JSX, Show } from 'solid-js';
import type { WordTileBoardCell, WordTileBoardProps } from './index';
import styles from './word-tile-board.module.css';

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
        props.onFocusIndex(props.index);
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

/** Coordinate headers and cells share one row-major keyboard index. */
export function BoardRows(props: {
  board: WordTileBoardProps;
  cells: () => readonly WordTileBoardCell[];
  focusIndex: () => number;
  onFocusIndex: (index: number) => void;
  onKey: (event: KeyboardEvent, index: number) => void;
}): JSX.Element {
  return (
    <>
      <span class={styles['header']} data-axis="corner" aria-hidden="true" />
      <For each={props.board.columnLabels}>
        {(label) => (
          <span class={styles['header']} data-axis="column" aria-hidden="true">
            {label}
          </span>
        )}
      </For>
      <For each={props.board.rowLabels}>
        {(label, row) => (
          <>
            <span class={styles['header']} data-axis="row" aria-hidden="true">
              {label}
            </span>
            <For each={props.board.columnLabels}>
              {(_, column) => {
                const index = () =>
                  row() * props.board.columnLabels.length + column();
                return (
                  <BoardCell
                    board={props.board}
                    cells={props.cells}
                    index={index()}
                    focusable={props.focusIndex() === index()}
                    onFocusIndex={props.onFocusIndex}
                    onKey={props.onKey}
                  />
                );
              }}
            </For>
          </>
        )}
      </For>
    </>
  );
}
