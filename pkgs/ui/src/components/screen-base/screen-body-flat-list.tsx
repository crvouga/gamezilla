/**
 * Full-bleed `FlatList` for nested lists inside a non-scrolling
 * {@link ScreenBase} body.
 *
 * Relies on {@link ContentEdgePaddingProvider} from the body shell so the
 * scrollbar sits flush with the screen edge. Prefer `ScreenBase` `scroll` when
 * the whole body scrolls; use this when sticky chrome sits above a scrolling
 * list.
 *
 * Pass `onRefresh` for themed pull-to-refresh (or supply a custom
 * `refreshControl`). Prefer this over FlatList's unthemed built-in control.
 */

import { forwardRef, type ReactElement } from 'react';
import type { RefreshControlProps, FlatList as RNFlatList } from 'react-native';

import { Box } from '../box';
import { FlatList, type FlatListProps } from '../flat-list';
import { useResolvedRefreshControl } from '../pull-to-refresh';

export type ScreenBodyFlatListProps<ItemT> = Omit<
  FlatListProps<ItemT>,
  'onRefresh' | 'refreshing' | 'refreshControl'
> & {
  /**
   * When set (and `refreshControl` is omitted), attaches a themed
   * pull-to-refresh control. Omit `refreshing` to manage spinner state
   * internally for the duration of the async action.
   */
  onRefresh?: (() => void | Promise<void>) | undefined;
  /** Controlled refreshing flag; omit for internal state via `onRefresh`. */
  refreshing?: boolean | undefined;
  refreshControl?: ReactElement<RefreshControlProps> | undefined;
};

export const ScreenBodyFlatList = forwardRef<
  // biome-ignore lint/suspicious/noExplicitAny: RN FlatList ref/component generics are invariant; item type flows via props
  RNFlatList<any>,
  // biome-ignore lint/suspicious/noExplicitAny: RN FlatList ref/component generics are invariant; item type flows via props
  ScreenBodyFlatListProps<any>
>(function ScreenBodyFlatList(
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
      <FlatList
        ref={ref}
        frameSx={[{ flex: 1 }, frameSx]}
        refreshControl={resolved}
        {...rest}
      />
    </Box>
  );
});
