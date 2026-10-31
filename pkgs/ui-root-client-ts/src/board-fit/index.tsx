/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createMemo, type JSX, Show } from 'solid-js';
import { bindElementTargets } from '../element-targets';
import { createMeasure } from '../measure';
import styles from './board-fit.module.css';

/** Raw press events over the board frame (a swipe recognizer's input). */
export type PointerHandlers = {
  readonly onPointerDown?: ((event: PointerEvent) => void) | undefined;
  readonly onPointerUp?: ((event: PointerEvent) => void) | undefined;
  readonly onPointerCancel?: (() => void) | undefined;
};

/** `fill` claims the parent's leftover room; `bounded` caps the height. */
export type BoardFitHeight = 'fill' | 'bounded';

export type BoardFitProps = {
  /** The board, given the side of the largest square that fits (px). */
  children: (size: number) => JSX.Element;
  /** Drawn over the square. */
  overlay?: JSX.Element | undefined;
  /** Follows the frame inside the same box (a move list, a timeline). */
  footer?: JSX.Element | undefined;
  /** Default `fill`. */
  height?: BoardFitHeight | undefined;
  pointer?: PointerHandlers | undefined;
  /** Rendered as `data-testid` on the measured frame. */
  testId?: string | undefined;
  /** DOM `data-*` identifiers on the outer box. */
  dataSet?: ComponentDataSet | undefined;
};

/** The largest whole-px square that fits a `width` × `height` frame. */
export function boardFitSize(width: number, height: number): number {
  return Math.max(0, Math.floor(Math.min(width, height)));
}

/**
 * `BoardFit` -- a square game board sized to the room it is given.
 *
 * The frame claims the space its parent leaves (`fill`, the board well of a
 * `PuzzleScreen`), or a capped height when it sits in a scroller (`bounded`,
 * a review under an `EmbeddedScreen`). It measures itself and hands the
 * largest square that fits, in whole CSS px, to `children`: a board that
 * draws on a canvas or lays out its own cells needs the number, not a class.
 * Nothing renders until the frame has a size.
 *
 * `overlay` sits over the square (marks, dialogs anchored to the board).
 * `footer` follows the frame inside the same bounded box (a move list), so
 * the board and its timeline share one height. `pointer` receives the raw
 * press events over the frame, for a swipe recognizer.
 *
 * @example
 * ```tsx
 * <BoardFit testId="board-frame">
 *   {(size) => <ChessBoard size={size} position={fen()} />}
 * </BoardFit>
 * <BoardFit height="bounded" footer={<MoveList … />}>
 *   {(size) => <ChessBoard size={size} position={fen()} />}
 * </BoardFit>
 * ```
 */
export function BoardFit(props: BoardFitProps): JSX.Element {
  const frame = createMeasure();
  // A frame that collapses for a moment (hidden, mid-layout) keeps the last
  // square instead of unmounting the board.
  const size = createMemo((previous: number) => {
    const next = boardFitSize(frame.width(), frame.height());
    return next > 0 ? next : previous;
  }, 0);
  const bounded = (): boolean => props.height === 'bounded';
  const measured = (
    <div
      ref={(element) => {
        bindElementTargets(element, { measureTarget: frame.target });
      }}
      class="box flex-1 min-h-0 min-w-0 self-stretch items-center justify-center overflow-hidden"
      data-testid={props.testId}
      onPointerDown={(event) => props.pointer?.onPointerDown?.(event)}
      onPointerUp={(event) => props.pointer?.onPointerUp?.(event)}
      onPointerCancel={() => props.pointer?.onPointerCancel?.()}
    >
      <Show when={size() > 0}>
        <div
          class="box relative min-w-0 shrink-0"
          style={{ width: `${size()}px`, height: `${size()}px` }}
        >
          {props.children(size())}
          {props.overlay}
        </div>
      </Show>
    </div>
  );
  return (
    <div
      class={
        bounded()
          ? `box self-stretch min-w-0 gap-2 ${styles['bounded']}`
          : 'box flex-1 min-h-0 min-w-0 self-stretch'
      }
      {...dataAttrs({ component: 'BoardFit', ...props.dataSet })}
    >
      {measured}
      {props.footer}
    </div>
  );
}
