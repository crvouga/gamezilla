/** @jsxImportSource solid-js */

import { componentId } from '@pkgs/ui-root-shared-ts/component-id';
import type { JSX } from 'solid-js';
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
  /** Rendered as `data-testid`. */
  testId?: string | undefined;
};

/**
 * `MoveStrip` -- a game's move list as one control-height row under the
 * board: `leading` and `trailing` controls (jump, step) at the ends and the
 * moves scrolling sideways between them, with no scrollbar. The row keeps
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
      class="box flex-row items-center justify-center self-stretch shrink-0 min-w-0 h-ui-control-sm"
      data-testid={props.testId}
      data-component={componentId('MoveStrip')}
      onPointerDown={(event) => props.pointer?.onPointerDown?.(event)}
      onPointerUp={(event) => props.pointer?.onPointerUp?.(event)}
      onPointerCancel={() => props.pointer?.onPointerCancel?.()}
    >
      <div class="box flex-row items-center shrink-0">{props.leading}</div>
      <ScrollView
        grow
        align="center"
        paddingX="md"
        gap="sm"
        horizontal
        hideScrollbar
      >
        {props.children}
      </ScrollView>
      <div class="box flex-row items-center shrink-0">{props.trailing}</div>
    </div>
  );
}
