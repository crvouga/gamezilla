import { useLingui } from '@lingui/react/macro';
import {
  StatusBar,
  StatusBarRegistryPortalBridge,
  StatusBarRegistryProvider,
} from '@pkgs/ui';
import type { ReactNode } from 'react';
import { View } from 'react-native';

import { AppStatusBarItems } from '../../ui/status-bar/app-status-bar-items';

/**
 * Global smartphone-style status bar: thin indicator strip + expanded panel.
 * Mount after UI portals so {@link StatusBar}'s ResponsiveSurface works, and
 * after inbox so notification items can read unread counts.
 *
 * {@link StatusBarRegistryPortalBridge} re-provides the registry inside
 * portaled surface content (panels that call {@link useStatusBar}).
 */
export function AppStatusBarRegistry({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const { t } = useLingui();
  // #region agent log
  fetch('http://127.0.0.1:7505/ingest/04ddb12b-5950-419d-86ab-fa995e703320', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Debug-Session-Id': '85764b',
    },
    body: JSON.stringify({
      sessionId: '85764b',
      runId: 'pre-fix',
      hypothesisId: 'E',
      location: 'status-bar-registry.tsx:AppStatusBarRegistry',
      message: 'AppStatusBarRegistry render',
      data: {},
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  return (
    <StatusBarRegistryProvider>
      <StatusBarRegistryPortalBridge>
        <AppStatusBarItems />
        <View style={{ flex: 1 }}>
          <StatusBar
            accessibilityLabel={t`Status bar`}
            panelTitle={t`Status`}
          />
          <View style={{ flex: 1 }}>{children}</View>
        </View>
      </StatusBarRegistryPortalBridge>
    </StatusBarRegistryProvider>
  );
}
