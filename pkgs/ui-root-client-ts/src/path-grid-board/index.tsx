import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Index,
  type JSX,
  onCleanup,
  Show,
  untrack,
} from 'solid-js';
import { cellGridStep } from '../cell-grid-board/index';
import { createPathGridPointer } from '../path-grid-pointer';
import type { PathGridBoardProps, PathGridEndpoint } from '../path-grid-types';
import styles from './path-grid-board.module.css';

export type {
  PathGridBoardProps,
  PathGridEndpoint,
  PathGridLine,
  PathGridTone,
  PathGridTraceCancellation,
} from '../path-grid-types';

/**
 * Splits a label into at most two balanced lines, so the longest allowed
 * label stays large enough to read inside one cell: at the space nearest
 * the middle, or mid-word with a hyphen so it still reads as one word.
 */
export function endpointLines(label: string): readonly string[] {
  if (label.length <= 4) return [label];
  const middle = label.length / 2;
  const spaces = [...label.matchAll(/ /g)].map((match) => match.index);
  const space = spaces.sort(
    (a, b) => Math.abs(a - middle) - Math.abs(b - middle)
  )[0];
  if (space !== undefined)
    return [label.slice(0, space), label.slice(space + 1)];
  const split = Math.ceil(middle);
  return [`${label.slice(0, split)}-`, label.slice(split)];
}

function PathCell(props: {
  board: PathGridBoardProps;
  index: number;
  endpoint: PathGridEndpoint | undefined;
  focusable: boolean;
  onFocus: () => void;
  onKey: (event: KeyboardEvent) => void;
}): JSX.Element {
  // Only a cell whose description changed is rewritten during a drawing.
  const label = createMemo(() => props.board.cellLabel(props.index));
  return (
    <button
      type="button"
      class={styles['cell']}
      data-cell={props.index}
      data-testid={`${props.board.testId}-cell-${props.index}`}
      data-tone={props.endpoint?.tone}
      data-connected={props.endpoint?.connected === true}
      data-selected={props.index === props.board.selectedCell}
      aria-current={
        props.index === props.board.selectedCell ? 'true' : undefined
      }
      aria-label={label()}
      aria-disabled={props.board.disabled === true}
      tabIndex={props.focusable ? 0 : -1}
      onFocus={() => props.onFocus()}
      onKeyDown={(event) => props.onKey(event)}
      onClick={(event) => {
        if (
          props.board.disabled !== true &&
          (props.board.onTraceStart === undefined || event.detail === 0)
        )
          props.board.onActivate?.(props.index);
      }}
    >
      <Show when={props.endpoint}>
        {(endpoint) => {
          const lines = createMemo(() => endpointLines(endpoint().label));
          return (
            <span
              class={styles['endpoint']}
              aria-hidden="true"
              data-shape={endpoint().label.length > 2 ? 'tag' : 'ring'}
              style={{
                '--endpoint-lines': lines().length,
                '--endpoint-columns': Math.max(
                  ...lines().map((line) => line.length)
                ),
                '--endpoint-glyph': /^\d+$/.test(endpoint().label) ? 0.6 : 0.8,
              }}
            >
              <For each={lines()}>
                {(line) => <span class={styles['endpoint-line']}>{line}</span>}
              </For>
            </span>
          );
        }}
      </Show>
    </button>
  );
}

function PathLines(props: { board: PathGridBoardProps }): JSX.Element {
  return (
    <svg
      class={styles['lines']}
      viewBox={`0 0 ${props.board.columns * 100} ${props.board.rows * 100}`}
      aria-hidden="true"
    >
      {/* By position, so a growing path updates its node in place. */}
      <Index each={props.board.lines}>
        {(line) => (
          <polyline
            class={styles['line']}
            data-path={line().id}
            data-tone={line().tone}
            data-connected={line().connected}
            data-provisional={line().provisional === true}
            points={line()
              .cells.map(
                (cell) =>
                  `${((cell % props.board.columns) + 0.5) * 100},${(Math.floor(cell / props.board.columns) + 0.5) * 100}`
              )
              .join(' ')}
          />
        )}
      </Index>
    </svg>
  );
}

/**
 * A fitted rectangular path surface. Rules and every interaction decision
 * belong to its consumer. Like the other game boards it keeps one palette
 * in both themes: its night canvas and bright paths, a board on the page
 * rather than a cream sheet in the light theme.
 */
export function PathGridBoard(props: PathGridBoardProps): JSX.Element {
  const [focus, setFocus] = createSignal(0);
  // Pointer drawing focuses its start cell from script (so Escape reaches
  // it), which browsers treat as keyboard focus: show the ring only after
  // a key press.
  const [input, setInput] = createSignal<'keyboard' | 'pointer'>('keyboard');
  const cells = createMemo(() =>
    Array.from({ length: props.columns * props.rows }, (_, index) => index)
  );
  const endpoints = createMemo(
    () => new Map(props.endpoints.map((endpoint) => [endpoint.cell, endpoint]))
  );
  let root: HTMLDivElement | undefined;
  const pointer = createPathGridPointer(props, () => root);
  createEffect(() => {
    void props.columns;
    void props.rows;
    void props.disabled;
    pointer.cancel();
    if (untrack(focus) >= props.columns * props.rows) setFocus(0);
  });
  onCleanup(pointer.cancel);
  const key = (event: KeyboardEvent, index: number): void => {
    setInput('keyboard');
    if (
      props.disabled !== true &&
      props.onCellKey?.(event.key, index) === true
    ) {
      event.preventDefault();
      return;
    }
    const next = cellGridStep(event, index, props);
    if (next === null) return;
    event.preventDefault();
    setFocus(next);
    root?.querySelector<HTMLButtonElement>(`[data-cell="${next}"]`)?.focus();
    if (props.disabled !== true) props.onNavigate?.(next);
  };
  return (
    <div
      ref={root}
      class={styles['board']}
      data-theme="dark"
      {...dataAttrs({ component: 'PathGridBoard' })}
      role="group"
      aria-label={props.label}
      aria-describedby={props.describedBy}
      data-testid={props.testId}
      data-tracing={props.disabled !== true && props.onTraceStart !== undefined}
      data-input={input()}
      style={{ '--path-columns': props.columns, '--path-rows': props.rows }}
      onPointerDown={(event) => {
        setInput('pointer');
        pointer.down(event);
      }}
      onPointerMove={pointer.move}
      onPointerUp={pointer.up}
      onPointerCancel={pointer.lost}
      onLostPointerCapture={pointer.lost}
    >
      <PathLines board={props} />
      <For each={cells()}>
        {(index) => (
          <PathCell
            board={props}
            index={index}
            endpoint={endpoints().get(index)}
            focusable={focus() === index}
            onFocus={() => setFocus(index)}
            onKey={(event) => key(event, index)}
          />
        )}
      </For>
    </div>
  );
}
