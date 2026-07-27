/**
 * Full-bleed `ScrollView` for nested lists inside a non-scrolling
 * {@link ScreenBase} body.
 *
 * Cancels {@link SCREEN_BODY_PADDING_STEP} horizontal body padding so the
 * scrollbar sits flush with the screen edge, then re-applies that padding on
 * `contentContainerStyle` via `sx`. Prefer `ScreenBase` `scroll` when the
 * whole body scrolls; use this when sticky chrome sits above a scrolling list.
 */

import { forwardRef } from 'react';
import type { ScrollView as RNScrollView } from 'react-native';

import { Box } from '../box';
import { ScrollView, type ScrollViewProps } from '../scroll-view';
import { SCREEN_BODY_PADDING_STEP } from './screen-body-padding';

export type ScreenBodyScrollViewProps = ScrollViewProps;

export const ScreenBodyScrollView = forwardRef<
  RNScrollView,
  ScreenBodyScrollViewProps
>(function ScreenBodyScrollView({ sx, style, ...rest }, ref) {
  return (
    <Box sx={{ flex: 1, mx: -SCREEN_BODY_PADDING_STEP, minHeight: 0 }}>
      <ScrollView
        ref={ref}
        style={[{ flex: 1 }, style]}
        sx={{ px: SCREEN_BODY_PADDING_STEP, ...sx }}
        {...rest}
      />
    </Box>
  );
});
