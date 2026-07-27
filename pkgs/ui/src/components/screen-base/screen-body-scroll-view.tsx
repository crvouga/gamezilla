/**
 * Full-bleed `ScrollView` for nested lists inside a non-scrolling
 * {@link ScreenBase} body.
 *
 * Relies on {@link ContentEdgePaddingProvider} from the body shell so the
 * scrollbar sits flush with the screen edge. Prefer `ScreenBase` `scroll` when
 * the whole body scrolls; use this when sticky chrome sits above a scrolling
 * list.
 */

import { forwardRef } from 'react';
import type { ScrollView as RNScrollView } from 'react-native';

import { Box } from '../box';
import { ScrollView, type ScrollViewProps } from '../scroll-view';

export type ScreenBodyScrollViewProps = ScrollViewProps;

export const ScreenBodyScrollView = forwardRef<
  RNScrollView,
  ScreenBodyScrollViewProps
>(function ScreenBodyScrollView({ style, ...rest }, ref) {
  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <ScrollView ref={ref} style={[{ flex: 1 }, style]} {...rest} />
    </Box>
  );
});
