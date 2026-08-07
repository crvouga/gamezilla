import { type ReactNode, useMemo, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import type { ComponentDataSet } from '../../component-id';
import { ResponsiveSurface } from '../responsive-surface';
import { StatusBarPanel } from './status-bar-panel';
import { useStatusBarRegistry } from './status-bar-registry-context';
import type { StatusBarRegistryStore } from './status-bar-registry-store';
import { StatusBarStrip, useStatusBarPushHeight } from './status-bar-strip';

export type StatusBarProps = {
  /**
   * When true (default), reserves vertical space on zero-inset platforms so
   * the absolute strip does not cover TopBar. On notched devices the strip
   * lives inside the safe-area padding already consumed by TopBar.
   */
  reserveSpace?: boolean;
  /** Accessibility label for the thin strip press target. */
  accessibilityLabel?: string;
  /** Title for the expanded surface. */
  panelTitle?: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

function useVisibleItems(store: StatusBarRegistryStore) {
  // Version is a stable primitive snapshot — `getVisibleSorted()` returns a
  // new array each call and would infinite-loop useSyncExternalStore.
  const version = useSyncExternalStore(
    (onStoreChange) => store.subscribe(onStoreChange),
    () => store.getVersion(),
    () => store.getVersion()
  );
  return useMemo(() => store.getVisibleSorted(), [store, version]);
}

/**
 * Global smartphone-style status bar host. Renders the thin indicator strip
 * and the expanded {@link ResponsiveSurface} control panel. Items are supplied
 * by features via {@link RegisterStatusBarItem}.
 *
 * Mount as the first child of a `flex: 1` column (before route content) so the
 * optional spacer can push layout on zero-inset platforms.
 */
export function StatusBar({
  reserveSpace = true,
  accessibilityLabel = 'Status bar',
  panelTitle = 'Status',
  dataSet,
}: StatusBarProps): ReactNode {
  const { store, isOpen, open, close } = useStatusBarRegistry();
  const items = useVisibleItems(store);
  const pushHeight = useStatusBarPushHeight();

  return (
    <>
      {reserveSpace && pushHeight > 0 ? (
        <View pointerEvents="none" style={{ height: pushHeight }} />
      ) : null}
      <StatusBarStrip
        items={items}
        onPress={open}
        accessibilityLabel={accessibilityLabel}
        {...(dataSet !== undefined ? { dataSet } : {})}
      />
      <ResponsiveSurface
        visible={isOpen}
        onClose={close}
        title={panelTitle}
        size="medium"
        stackId="app-status-bar"
      >
        <StatusBarPanel items={items} />
      </ResponsiveSurface>
    </>
  );
}
