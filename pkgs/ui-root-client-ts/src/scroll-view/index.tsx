/** @jsxImportSource solid-js */

import { componentDataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import { useContentEdgePadding } from '../content-edge-padding/index';
import { flexContainerClass, spaced } from '../layout-classes';
import type { Align } from '../layout-props';
import { SCREEN_MAX_WIDTH, type ScreenMeasure } from '../screen-measure';
import type { ScrollFrameProps } from '../scroll-frame';
import { scrollFlush, scrollFrameClass, scrollHandlers } from '../scroll-frame';
import type { SpacingProps } from '../space-classes';
import { spacingClass } from '../space-classes';

export type { ScrollMaxHeight, ScrollRole } from '../scroll-frame';

export type ScrollViewProps = ScrollFrameProps &
  SpacingProps & {
    /** Cross-axis alignment of the content. Default `stretch`. */
    align?: Align | undefined;
    /** Grow the content to at least the scroller height (pins a footer). */
    fill?: boolean | undefined;
    /** Cap the content at a screen measure (`menu` / `prose` / `full`). */
    measure?: ScreenMeasure | undefined;
    /**
     * Where a measured content column sits: on the leading edge (default)
     * or centered in the scroller, the scrollbar still at the frame edge.
     */
    measureAlign?: 'start' | 'center' | undefined;
    /** Scroll along the x axis instead. */
    horizontal?: boolean | undefined;
    /** Hide the scrollbar (still scrollable). */
    hideScrollbar?: boolean | undefined;
    children?: JSX.Element | undefined;
  };

function measureClass(
  measure: ScrollViewProps['measure'],
  align: ScrollViewProps['measureAlign']
): string | undefined {
  if (measure === undefined) return undefined;
  return align === 'center' ? 'w-full mx-auto' : 'self-start w-full';
}

/**
 * `ScrollView` -- overflow-auto scroller with a flex content container.
 *
 * The scroller takes the layout item props (`grow`, `self`, `width`,
 * `height`, `maxWidth`, `minHeight`), a `maxHeight` cap and a surface `tone`;
 * the content takes the spacing props (`gap`, `padding*`), `align` and
 * `fill`, and a screen `measure` (on the leading edge, or centered with
 * `measureAlign="center"`). Inside a padded shell the scroller bleeds under
 * the shell's edge padding (`flushEdge`) so the scrollbar sits flush with the
 * frame.
 */
export function ScrollView(props: ScrollViewProps): JSX.Element {
  const edge = useContentEdgePadding();
  const flush = () => scrollFlush(edge, props);
  const scrollerClass = () =>
    spaced([
      'scroll',
      props.horizontal === true ? 'scrollHorizontal' : undefined,
      props.hideScrollbar === true ? 'scrollHideBar' : undefined,
      scrollFrameClass(props),
    ]);
  const contentClass = () =>
    spaced([
      'scrollContent',
      props.horizontal === true ? 'scrollContentHorizontal' : undefined,
      flush().contentClass,
      spacingClass(props),
      flexContainerClass({ align: props.align }),
      props.fill === true ? 'grow' : undefined,
      measureClass(props.measure, props.measureAlign),
    ]);
  // The measure is a CSS width, not a token class: a dynamic value.
  const contentStyle = (): JSX.CSSProperties | undefined =>
    props.measure === undefined
      ? undefined
      : { 'max-width': SCREEN_MAX_WIDTH[props.measure] };
  const scroller = (
    <div
      ref={props.ref}
      class={scrollerClass()}
      {...componentDataAttrs('ScrollView', props.dataSet)}
      id={props.id}
      role={props.role}
      aria-label={props['aria-label']}
      aria-labelledby={props['aria-labelledby']}
      tabIndex={props.tabIndex ?? 0}
      {...scrollHandlers(props)}
    >
      <div
        class={contentClass()}
        style={contentStyle()}
        data-component="ScrollViewContent"
      >
        {props.children}
      </div>
    </div>
  );
  return (
    <Show when={flush().wrapperClass} fallback={scroller}>
      {(wrapperClass) => (
        <div class={wrapperClass()} style={flush().wrapperStyle}>
          {scroller}
        </div>
      )}
    </Show>
  );
}
