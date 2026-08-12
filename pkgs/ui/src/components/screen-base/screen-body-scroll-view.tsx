/**
 * Full-bleed `ScrollView` for nested lists inside a non-scrolling
 * {@link ScreenBase} body.
 *
 * Relies on {@link ContentEdgePaddingProvider} from the body shell so the
 * scrollbar sits flush with the screen edge. Prefer `ScreenBase` `scroll` when
 * the whole body scrolls; use this when sticky chrome sits above a scrolling
 * list.
 *
 * Pass `onRefresh` for themed pull-to-refresh (or supply a custom
 * `refreshControl`).
 */

import { forwardRef } from 'react';
import type { ScrollView as RNScrollView } from 'react-native';

import { Box } from '../box';
import { useResolvedRefreshControl } from '../pull-to-refresh';
import { ScrollView, type ScrollViewProps } from '../scroll-view';

export type ScreenBodyScrollViewProps = ScrollViewProps & {
  /**
   * When set (and `refreshControl` is omitted), attaches a themed
   * pull-to-refresh control. Omit `refreshing` to manage spinner state
   * internally for the duration of the async action.
   */
  onRefresh?: (() => void | Promise<void>) | undefined;
  /** Controlled refreshing flag; omit for internal state via `onRefresh`. */
  refreshing?: boolean | undefined;
};

export const ScreenBodyScrollView = forwardRef<
  RNScrollView,
  ScreenBodyScrollViewProps
>(function ScreenBodyScrollView(
  { frameSx, onRefresh, refreshing, refreshControl, ...rest },
  ref
) {
  const resolved = useResolvedRefreshControl({
    onRefresh,
    refreshing,
    refreshControl,
  });
  return (
    <Box sx={{ flex: 1, minHeight: 0 }}>
      <ScrollView
        ref={ref}
        frameSx={[{ flex: 1 }, frameSx]}
        refreshControl={resolved}
        {...rest}
      />
    </Box>
  );
});
