import { useHostChrome } from '@apps/client/host/host-chrome-context';
import { Box, TabStrip, Text } from '@pkgs/ui';
import { type ReactNode, useMemo } from 'react';

import type { ClientHostProps } from './hosted-sub-app';

/**
 * Thin composition chrome: Main | Console (and any future sub-apps).
 * Host selection comes from {@link useHostChrome} (URL-synced on web).
 */
export function ClientHost(props: ClientHostProps): ReactNode {
  const { apps } = props;
  const { state, patch } = useHostChrome();
  const selectedId = state.host;
  const selected = useMemo(
    () => apps.find((a) => a.id === selectedId) ?? apps[0],
    [apps, selectedId]
  );

  if (selected === undefined) {
    return (
      <Box sx={{ flex: 1, padding: 4, background: 'background' }}>
        <Text label="No sub-apps composed" />
      </Box>
    );
  }

  const SelectedApp = selected.App;

  return (
    <Box sx={{ flex: 1, background: 'background' }}>
      <TabStrip
        accessibilityLabel="Apps"
        items={apps.map((app) => ({
          id: app.id,
          label: app.title,
          ...(app.icon !== undefined ? { icon: app.icon } : {}),
        }))}
        selectedId={selected.id}
        onSelect={(id) => {
          if (id === 'main' || id === 'console') {
            patch({ host: id });
          }
        }}
      />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <SelectedApp />
      </Box>
    </Box>
  );
}
