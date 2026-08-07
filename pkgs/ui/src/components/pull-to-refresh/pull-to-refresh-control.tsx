/**
 * Themed `RefreshControl` for pull-to-refresh on ScrollView / FlatList.
 *
 * App-agnostic: pass `refreshing` + `onRefresh`; wire domain refresh in the
 * caller (e.g. sync-engine `refreshQueries()`).
 */

import { RefreshControl } from 'react-native';
import { type ComponentDataSet, componentDataSet } from '../../component-id';
import { useTheme } from '../../theme';

export type PullToRefreshControlProps = {
  refreshing: boolean;
  onRefresh: () => void;
  /** Android: whether pull-to-refresh is enabled. Default true. */
  enabled?: boolean;
  /** Top offset for the progress view. */
  progressViewOffset?: number;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

export function PullToRefreshControl({
  refreshing,
  onRefresh,
  enabled = true,
  progressViewOffset,
  dataSet,
}: PullToRefreshControlProps) {
  const theme = useTheme();
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      enabled={enabled}
      progressViewOffset={progressViewOffset}
      tintColor={theme.colors.tint}
      colors={[theme.colors.tint]}
      progressBackgroundColor={theme.colors.surface}
      {...componentDataSet('PullToRefreshControl', dataSet)}
    />
  );
}
