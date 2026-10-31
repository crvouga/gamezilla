import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  type JSX,
  onCleanup,
  Show,
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
} from '../path-grid-types';

function PathCell(props: {
  board: PathGridBoardProps;
  index: number;
  endpoint: PathGridEndpoint | undefined;
  focusable: boolean;
  onFocus: () => void;
  onKey: (event: KeyboardEvent) => void;
}): JSX.Element {
  return (
    <button
      type="button"
      class={styles['cell']}
      data-cell={props.index}
      data-testid={`${props.board.testId}-cell-${props.index}`}
      data-tone={props.endpoint?.tone}
      data-connected={props.endpoint?.connected === true}
      aria-label={props.board.cellLabel(props.index)}
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
        {(endpoint) => (
          <span class={styles['endpoint']} aria-hidden="true">
            {endpoint().label}
          </span>
        )}
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
      <For each={props.board.lines}>
        {(line) => (
          <polyline
            class={styles['line']}
            data-path={line.id}
            data-tone={line.tone}
            data-connected={line.connected}
            points={line.cells
              .map(
                (cell) =>
                  `${((cell % props.board.columns) + 0.5) * 100},${(Math.floor(cell / props.board.columns) + 0.5) * 100}`
              )
              .join(' ')}
          />
        )}
      </For>
    </svg>
  );
}

/** A fitted rectangular path surface. Rules and every interaction decision belong to its consumer. */
export function PathGridBoard(props: PathGridBoardProps): JSX.Element {
  const [focus, setFocus] = createSignal(0);
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
    if (focus() >= props.columns * props.rows) setFocus(0);
  });
  onCleanup(pointer.cancel);
  const key = (event: KeyboardEvent, index: number): void => {
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
      {...dataAttrs({ component: 'PathGridBoard' })}
      role="group"
      aria-label={props.label}
      aria-describedby={props.describedBy}
      data-testid={props.testId}
      data-tracing={props.disabled !== true && props.onTraceStart !== undefined}
      style={{ '--path-columns': props.columns, '--path-rows': props.rows }}
      onPointerDown={pointer.down}
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
