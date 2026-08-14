// @io-wall-ok
/**
 * Side-by-side Alice / Bob product Apps on one in-process World (Expo web).
 */

import { App } from '@apps/client/app';
import '@apps/client/i18n/i18n';
import { Box, Stack, Text } from '@pkgs/ui';
import { StatusBar } from 'expo-status-bar';
import { type ReactNode, useEffect, useState } from 'react';

import { bootPlaygroundWorld, type PlaygroundWorld } from './boot-world';

function PhoneFrame(props: {
  readonly label: string;
  readonly children: ReactNode;
}): ReactNode {
  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 320,
        maxWidth: 480,
        borderWidth: 1,
        borderColor: 'border',
        borderRadius: 'lg',
        overflow: 'hidden',
        background: 'background',
      }}
    >
      <Box
        sx={{
          paddingHorizontal: 3,
          paddingVertical: 2,
          borderBottomWidth: 1,
          borderColor: 'border',
          background: 'surface',
        }}
      >
        <Text
          variant="label"
          label={props.label}
          sx={{ color: 'textSecondary' }}
        />
      </Box>
      <Box sx={{ flex: 1, minHeight: 640 }}>{props.children}</Box>
    </Box>
  );
}

export function PlaygroundApp(): ReactNode {
  const [session, setSession] = useState<PlaygroundWorld | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let active: PlaygroundWorld | null = null;
    void (async () => {
      try {
        const next = await bootPlaygroundWorld();
        if (cancelled) {
          await next.dispose();
          return;
        }
        active = next;
        setSession(next);
      } catch (err) {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
      if (active !== null) {
        void active.dispose();
      }
    };
  }, []);

  if (error !== null) {
    return (
      <Box sx={{ flex: 1, padding: 4, background: 'background' }}>
        <Text variant="title" label="Playground failed to boot" />
        <Text label={error} sx={{ color: 'destructive', marginTop: 2 }} />
      </Box>
    );
  }

  if (session === null) {
    return (
      <Box
        sx={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          background: 'background',
        }}
      >
        <Text label="Booting in-process world…" />
      </Box>
    );
  }

  const { alice, bob } = session.actors;

  return (
    <Box sx={{ flex: 1, background: 'background', padding: 3 }}>
      <StatusBar style="auto" />
      <Stack spacing={3} sx={{ flex: 1 }}>
        <Text variant="title" label="System playground" />
        <Text
          label="Two product Apps · one in-process API · shared pubsub"
          sx={{ color: 'textSecondary' }}
        />
        <Stack
          direction="horizontal"
          spacing={3}
          align="stretch"
          justify="center"
          sx={{ flex: 1 }}
        >
          <PhoneFrame label="alice">
            <App embedded io={alice.io} resources={alice.seams.resources} />
          </PhoneFrame>
          <PhoneFrame label="bob">
            <App embedded io={bob.io} resources={bob.seams.resources} />
          </PhoneFrame>
        </Stack>
      </Stack>
    </Box>
  );
}
