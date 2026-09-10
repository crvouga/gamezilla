/** @jsxImportSource solid-js */
/**
 * `ScrollView` -- overflow-auto scroller with a flex content container.
 *
 * Frame styling uses `class` / `classList` / `style`; content styling uses
 * `contentClass` / `contentClassList` / `contentStyle`. Inside a padded shell
 * the scroller bleeds under the shell's edge padding (`flushEdge`) so the
 * scrollbar sits flush with the frame.
 */

import { type JSX, Show, splitProps } from 'solid-js';
import { type ComponentDataSet, componentDataAttrs } from '../../component-id';
import {
  requestsFlexFill,
  resolveFlushEdgeStyles,
  useContentEdgePadding,
} from '../content-edge-padding';
import styles from '../hosts.module.css';

export type ScrollViewProps = Omit<
  JSX.HTMLAttributes<HTMLDivElement>,
  'children' | 'ref'
> & {
  /** Extra classes on the content container. */
  contentClass?: string | undefined;
  /** Solid `classList` on the content container. */
  contentClassList?: Record<string, boolean | undefined> | undefined;
  /** Inline styles on the content container. */
  contentStyle?: JSX.CSSProperties | undefined;
  /** Scroll along the x axis instead. */
  horizontal?: boolean | undefined;
  /** Hide the scrollbar (still scrollable). */
  hideScrollbar?: boolean | undefined;
  /**
   * When inside a padded shell, cancel edge padding so the scrollbar is flush.
   * Default `true`.
   */
  flushEdge?: boolean | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
  /** Scroller element ref (call `scrollTo` / read `scrollTop`). */
  ref?: ((el: HTMLDivElement) => void) | undefined;
  children?: JSX.Element | undefined;
};

export function ScrollView(props: ScrollViewProps): JSX.Element {
  const edge = useContentEdgePadding();
  const [local, rest] = splitProps(props, [
    'contentClass',
    'contentClassList',
    'contentStyle',
    'horizontal',
    'hideScrollbar',
    'flushEdge',
    'dataSet',
    'class',
    'classList',
    'children',
  ]);
  const flush = () => resolveFlushEdgeStyles(edge, local.flushEdge ?? true);
  const flexFill = () => requestsFlexFill(local.class, local.classList);
  const scrollerClass = () =>
    [
      styles['scroll'],
      local.horizontal ? styles['scrollHorizontal'] : undefined,
      local.hideScrollbar ? styles['scrollHideBar'] : undefined,
      local.class,
    ]
      .filter(Boolean)
      .join(' ');
  const contentClass = () =>
    [
      styles['scrollContent'],
      local.horizontal ? styles['scrollContentHorizontal'] : undefined,
      flush().contentClass,
      local.contentClass,
    ]
      .filter(Boolean)
      .join(' ');
  const scroller = (
    <div
      class={scrollerClass()}
      classList={local.classList}
      {...componentDataAttrs('ScrollView', local.dataSet)}
      {...rest}
    >
      <div
        class={contentClass()}
        classList={local.contentClassList}
        style={local.contentStyle}
        data-component="ScrollViewContent"
      >
        {local.children}
      </div>
    </div>
  );
  return (
    <Show when={flush().wrapperClass} fallback={scroller}>
      {(wrapperClass) => (
        <div
          class={[wrapperClass(), flexFill() ? 'flex-1' : undefined]
            .filter(Boolean)
            .join(' ')}
          style={flush().contentStyle}
        >
          {scroller}
        </div>
      )}
    </Show>
  );
}
