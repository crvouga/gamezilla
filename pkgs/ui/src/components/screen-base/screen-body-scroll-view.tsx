/** @jsxImportSource solid-js */
/**
 * Full-bleed `ScrollView` for nested lists inside a non-scrolling
 * `ScreenBase` body.
 *
 * Relies on `ContentEdgePaddingProvider` from the body shell so the
 * scrollbar sits flush with the screen edge. Prefer `ScreenBase` `scroll`
 * when the whole body scrolls; use this when sticky chrome sits above a
 * scrolling list.
 */

import { type JSX, splitProps } from 'solid-js';
import { ScrollView, type ScrollViewProps } from '../scroll-view';

export type ScreenBodyScrollViewProps = ScrollViewProps;

export function ScreenBodyScrollView(
  props: ScreenBodyScrollViewProps
): JSX.Element {
  const [local, rest] = splitProps(props, ['class', 'dataSet']);
  return (
    <div class="flex-1 min-h-0">
      <ScrollView
        class="flex-1"
        classList={{ [String(local.class)]: true }}
        dataSet={{ component: 'ScreenBodyScrollView', ...local.dataSet }}
        {...rest}
      />
    </div>
  );
}
