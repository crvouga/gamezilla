/**
 * Builds a themed {@link PullToRefreshControl} for scroll hosts when the
 * caller passes `onRefresh` and does not supply a custom `refreshControl`.
 *
 * On web, always returns `undefined`: react-native-web's `RefreshControl` is
 * a stub that, when passed as `ScrollView`/`FlatList` `refreshControl`, causes
 * the scroller to render no children (blank screen body).
 */

import type { ReactElement } from 'react';
import { Platform, type RefreshControlProps } from 'react-native';

import { PullToRefreshControl } from './pull-to-refresh-control';
import { usePullToRefresh } from './use-pull-to-refresh';

export type RefreshControlElement = ReactElement<RefreshControlProps>;

export type RefreshControlHostProps = {
  readonly onRefresh?: (() => void | Promise<void>) | undefined;
  readonly refreshing?: boolean | undefined;
  readonly refreshControl?: RefreshControlElement | undefined;
};

export function useResolvedRefreshControl(
  props: RefreshControlHostProps
): RefreshControlElement | undefined {
  const managed = usePullToRefresh(props.onRefresh, props.refreshing);
  if (Platform.OS === 'web') return undefined;
  if (props.refreshControl !== undefined) return props.refreshControl;
  if (managed === null) return undefined;
  return (
    <PullToRefreshControl
      refreshing={managed.refreshing}
      onRefresh={managed.onRefresh}
    />
  );
}
