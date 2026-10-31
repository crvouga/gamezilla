/** @jsxImportSource solid-js */

import type { JSX } from 'solid-js';
import type { ScrollViewProps } from '../scroll-view/index';
import { ScrollView } from '../scroll-view/index';

export type ScreenBodyScrollViewProps = Omit<
  ScrollViewProps,
  'grow' | 'class' | 'contentClass' | 'contentStyle' | 'tabindex'
>;

/**
 * Full-bleed `ScrollView` for nested lists inside a non-scrolling
 * `ScreenBase` body.
 *
 * Relies on `ContentEdgePaddingProvider` from the body shell so the
 * scrollbar sits flush with the screen edge. Prefer `ScreenBase` `scroll`
 * when the whole body scrolls; use this when sticky chrome sits above a
 * scrolling list. It always grows into the body's leftover height.
 */
export function ScreenBodyScrollView(
  props: ScreenBodyScrollViewProps
): JSX.Element {
  return (
    <div class="flex-1 min-h-0">
      <ScrollView
        {...props}
        grow
        dataSet={{ component: 'ScreenBodyScrollView', ...props.dataSet }}
      />
    </div>
  );
}
