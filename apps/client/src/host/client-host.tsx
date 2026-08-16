import { Box, TabStrip, Text } from '@pkgs/ui';
import { type ReactNode, useMemo, useState } from 'react';

import type { ClientHostProps } from './hosted-sub-app';

/**
 * Thin composition chrome: Main | Console (and any future sub-apps).
 * Depends only on {@link HostedSubApp} — implementations are injected.
 */
export function ClientHost(props: ClientHostProps): ReactNode {
  const { apps, initialId } = props;
  const defaultId = initialId ?? apps[0]?.id ?? '';
  const [selectedId, setSelectedId] = useState(defaultId);
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
        items={apps.map((app) => ({ id: app.id, label: app.title }))}
        selectedId={selected.id}
        onSelect={setSelectedId}
      />
      <Box sx={{ flex: 1, minHeight: 0 }}>
        <SelectedApp />
      </Box>
    </Box>
  );
}
