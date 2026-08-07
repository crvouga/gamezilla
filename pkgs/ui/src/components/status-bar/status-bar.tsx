import type { ReactNode } from 'react';
import { View } from 'react-native';

import type { ComponentDataSet } from '../../component-id';
import { useTheme } from '../../theme';
import { ResponsiveSurface } from '../responsive-surface';
import { StatusBarPanel } from './status-bar-panel';
import { useStatusBarRegistry } from './status-bar-registry-context';
import { StatusBarStrip, useStatusBarPushHeight } from './status-bar-strip';

export type StatusBarProps = {
  /**
   * When true (default), reserves the strip body height so the absolute
   * overlay does not cover TopBar. Safe-area top inset stays on ScreenBase /
   * TopBar; the strip paints that zone and places icons below it.
   */
  reserveSpace?: boolean;
  /** Accessibility label for the thin strip (swipe down to open). */
  accessibilityLabel?: string;
  /** Title for the expanded surface. */
  panelTitle?: ReactNode;
  /** Web DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet;
};

/**
 * Global smartphone-style status bar host. Items come from
 * {@link StatusBarRegistryProvider} React state.
 */
export function StatusBar({
  reserveSpace = true,
  accessibilityLabel = 'Status bar',
  panelTitle = 'Status',
  dataSet,
}: StatusBarProps): ReactNode {
  const theme = useTheme();
  const { items, isOpen, open, close } = useStatusBarRegistry();
  const pushHeight = useStatusBarPushHeight();

  return (
    <>
      {reserveSpace && pushHeight > 0 ? (
        <View
          pointerEvents="none"
          style={{
            height: pushHeight,
            backgroundColor: theme.colors.surface,
          }}
        />
      ) : null}
      <StatusBarStrip
        items={items}
        onOpen={open}
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
