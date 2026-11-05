/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import type { PointerHandlers } from '../board-fit/index';
import { ScrollView } from '../scroll-view/index';

export type MoveStripProps = {
  /** The moves. Unset renders the empty row at its full height. */
  children?: JSX.Element | undefined;
  /** Controls before the moves (jump to start, step back). */
  leading?: JSX.Element | undefined;
  /** Controls after the moves (step forward, jump to end). */
  trailing?: JSX.Element | undefined;
  pointer?: PointerHandlers | undefined;
  /**
   * `fill` (default): the moves take the row between the controls, which
   * stay at its ends. `content`: the row is as wide as its moves, centred,
   * so a short line keeps its step controls right beside its moves instead
   * of across an empty gap; it still scrolls once the moves fill the row.
   */
  fit?: 'fill' | 'content' | undefined;
  /**
   * `scroll` (default): one row that scrolls sideways once the moves fill
   * it. `wrap`: the moves wrap onto further rows instead, every move whole
   * and in view, for a short line (a puzzle's) where no move may be cut at
   * the strip's edge; the row still keeps its height with no moves.
   */
  overflow?: 'scroll' | 'wrap' | undefined;
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

/**
 * `MoveStrip` -- a game's move list as one control-height (44px) row under
 * the board: `leading` and `trailing` controls (jump, step) at the ends,
 * spaced so each is its own target, and the moves between them, scrolling
 * sideways with no scrollbar when they do not fit. The row keeps
 * its height with no moves at all, so the board above never resizes when
 * the first move lands. `pointer` receives the raw press events over the
 * whole row, for a swipe recognizer.
 *
 * @example
 * ```tsx
 * <MoveStrip
 *   leading={<IconButton … />}
 *   trailing={<IconButton … />}
 *   pointer={swipe}
 * >
 *   <For each={plies()}>{(ply) => <PlyChip ply={ply} />}</For>
 * </MoveStrip>
 * ```
 */
export function MoveStrip(props: MoveStripProps): JSX.Element {
  return (
    <div
      class="box flex-row items-center justify-center self-stretch shrink-0 min-w-0"
      classList={{
        'h-ui-control-md': props.overflow !== 'wrap',
        'min-h-ui-control-md': props.overflow === 'wrap',
      }}
      data-testid={props.testId}
      data-component={componentId('MoveStrip')}
      data-fit={props.fit ?? 'fill'}
      data-overflow={props.overflow ?? 'scroll'}
      onPointerDown={(event) => props.pointer?.onPointerDown?.(event)}
      onPointerUp={(event) => props.pointer?.onPointerUp?.(event)}
      onPointerCancel={() => props.pointer?.onPointerCancel?.()}
    >
      <div class="box flex-row items-center gap-1 shrink-0">
        {props.leading}
      </div>
      <Show
        when={props.overflow === 'wrap'}
        fallback={
          <ScrollView
            grow={props.fit !== 'content'}
            align="center"
            paddingX="md"
            gap="sm"
            horizontal
            hideScrollbar
          >
            {props.children}
          </ScrollView>
        }
      >
        {/* Shrinks to the row (a box keeps its width unless it may
            shrink), so its moves wrap inside it instead of running out. */}
        <div class="box flex-row flex-wrap items-center gap-2 grow shrink min-w-0">
          {props.children}
        </div>
      </Show>
      <div class="box flex-row items-center gap-1 shrink-0">
        {props.trailing}
      </div>
    </div>
  );
}
