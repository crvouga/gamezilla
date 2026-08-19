import { useHostChrome } from '@apps/client/host/host-chrome-context';
import { Box, TabStrip, Text } from '@pkgs/ui';
import { type ReactNode, useMemo } from 'react';

import type { ClientHostProps } from './hosted-sub-app';

/**
 * Top chrome: Client | System. Host selection comes from {@link useHostChrome}
 * (URL-synced on web).
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
    <Box sx={shellSx}>
      <Box sx={chromeSx}>
        <TabStrip
          accessibilityLabel="Apps"
          keyboardScope
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
      </Box>
      <Box sx={bodySx}>
        <SelectedApp />
      </Box>
    </Box>
  );
}

const shellSx = {
  flex: 1,
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  minHeight: 0,
  overflow: 'hidden',
  background: 'background',
} as const;

const chromeSx = {
  flexGrow: 0,
  flexShrink: 0,
  zIndex: 20,
} as const;

const bodySx = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden',
} as const;
