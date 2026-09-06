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
import { Box } from '../box';
import { ScrollView, type ScrollViewProps } from '../scroll-view';

export type ScreenBodyScrollViewProps = ScrollViewProps;

export function ScreenBodyScrollView(
  props: ScreenBodyScrollViewProps
): JSX.Element {
  const [local, rest] = splitProps(props, ['frameSx', 'dataSet']);
  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <ScrollView
        frameSx={[{ flex: 1 }, local.frameSx]}
        dataSet={{ component: 'ScreenBodyScrollView', ...local.dataSet }}
        {...rest}
      />
    </Box>
  );
}
