/**
 * Closed prop vocabulary shared by the scroll hosts (`ScrollView`,
 * `VirtualList`): how the scroller sits in its parent, how tall it may grow,
 * what it is called, and the flush-edge wrapper that lets it bleed under a
 * padded shell. Design-system internal; the hosts re-export the types.
 */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import type { SurfaceTone } from '@pkgs/ui-root-shared-ts/token-names';
import type { JSX } from 'solid-js';
import type { ContentEdgePadding } from './content-edge-padding/index';
import { resolveFlushEdgeStyles } from './content-edge-padding/index';
import { flexItemClass, spaced, surfaceClass } from './layout-classes';
import type { FlexItemProps } from './layout-props';

/**
 * Cap on the scroller height: `sm` (192) a detail well, `md` (360) a popover
 * list, `lg` (480) a list inside a sheet.
 */
export type ScrollMaxHeight = 'sm' | 'md' | 'lg';

/** Roles a scroll region may take. */
export type ScrollRole =
  | 'region'
  | 'group'
  | 'list'
  | 'listbox'
  | 'tablist'
  | 'tree';

/** The scroller element: placement, size, fill, name and events. */
export type ScrollFrameProps = FlexItemProps & {
  /** Cap the scroller height; it scrolls past it. */
  maxHeight?: ScrollMaxHeight | undefined;
  /** Fill the scroller with a surface role. Default transparent. */
  tone?: SurfaceTone | undefined;
  /**
   * When inside a padded shell, cancel edge padding so the scrollbar is flush.
   * Default `true`.
   */
  flushEdge?: boolean | undefined;
  /**
   * With `flushEdge`, re-apply the shell's side padding inside the scroller.
   * `false` lets the rows run edge to edge. Default `true`.
   */
  edgeInset?: boolean | undefined;
  id?: string | undefined;
  role?: ScrollRole | undefined;
  'aria-label'?: string | undefined;
  'aria-labelledby'?: string | undefined;
  /** `0` makes a scroll region reachable by keyboard. */
  tabIndex?: number | undefined;
  onScroll?: JSX.EventHandler<HTMLDivElement, Event> | undefined;
  onKeyDown?: JSX.EventHandler<HTMLDivElement, KeyboardEvent> | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-testid`, …). */
  dataSet?: ComponentDataSet | undefined;
  /** Scroller element ref (call `scrollTo` / read `scrollTop`). */
  ref?: ((el: HTMLDivElement) => void) | undefined;
};

const MAX_HEIGHT: Readonly<Record<ScrollMaxHeight, string>> = {
  sm: 'max-h-48',
  md: 'max-h-90',
  lg: 'max-h-120',
};

/** Placement, height cap and fill classes of the scroller element. */
export function scrollFrameClass(frame: ScrollFrameProps): string {
  return spaced([
    flexItemClass(frame),
    frame.maxHeight === undefined ? undefined : MAX_HEIGHT[frame.maxHeight],
    frame.tone === undefined ? undefined : surfaceClass(frame.tone),
  ]);
}

/** The flush-edge wrapper and content classes for `frame` inside `edge`. */
export function scrollFlush(
  edge: ContentEdgePadding | null,
  frame: ScrollFrameProps
): {
  contentClass: string | undefined;
  wrapperClass: string | undefined;
  wrapperStyle: JSX.CSSProperties | undefined;
} {
  const flush = resolveFlushEdgeStyles(edge, {
    flushEdge: frame.flushEdge ?? true,
    inset: frame.edgeInset ?? true,
  });
  return {
    contentClass: flush.contentClass,
    // A growing scroller fills its flex parent through the wrapper too, so
    // `.scroll` receives a definite height.
    wrapperClass:
      flush.wrapperClass === undefined
        ? undefined
        : spaced([
            flush.wrapperClass,
            frame.grow === true ? 'flex-1 min-h-0' : undefined,
          ]),
    wrapperStyle: flush.contentStyle,
  };
}

/** The scroller's event handlers, read at event time so a replaced handler prop takes effect. */
export function scrollHandlers(frame: ScrollFrameProps): {
  onScroll: JSX.EventHandler<HTMLDivElement, Event>;
  onKeyDown: JSX.EventHandler<HTMLDivElement, KeyboardEvent>;
} {
  return {
    onScroll: (event) => frame.onScroll?.(event),
    onKeyDown: (event) => frame.onKeyDown?.(event),
  };
}
