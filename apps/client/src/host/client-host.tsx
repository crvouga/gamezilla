import { Box, Pressable, Stack, Text } from '@pkgs/ui';
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
      <Stack
        direction="horizontal"
        spacing={1}
        sx={{
          paddingHorizontal: 2,
          paddingVertical: 2,
          borderBottomWidth: 1,
          borderColor: 'border',
          background: 'surface',
        }}
      >
        {apps.map((app) => {
          const active = app.id === selected.id;
          return (
            <Pressable
              key={app.id}
              onPress={() => setSelectedId(app.id)}
              sx={{
                paddingHorizontal: 3,
                paddingVertical: 2,
                borderRadius: 'md',
                borderWidth: 1,
                borderColor: active ? 'tint' : 'border',
                background: active ? 'tintSubtle' : 'surface',
              }}
            >
              <Text
                variant="label"
                label={app.title}
                sx={{ color: active ? 'tint' : 'text' }}
              />
            </Pressable>
          );
        })}
      </Stack>
      <Box sx={{ flex: 1 }}>
        <SelectedApp />
      </Box>
    </Box>
  );
}
