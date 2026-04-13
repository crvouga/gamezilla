import { useMemo, useState } from 'react';
import type { PlaygroundSim } from '@gamezilla/patch-db/sim/playground-sim';
import { useTheme } from '@gamezilla/shared/theme';
import { Box, SafeAreaView, Text, Spinner, Stack } from '@gamezilla/shared/ui';
import { PatchdbAppNav, readStoredMode, type PatchdbAppMode } from './nav';
import { PlaygroundHeader } from './playground-header';
import { PlaygroundLayout } from './playground-layout';
import { SimProvider, type SimContextValue } from './sim-context';
import { ApiInspector } from './api-inspector';
import { usePlaygroundBoot } from './use-playground-boot';

export function PlaygroundApp() {
  const [mode, setMode] = useState<PatchdbAppMode>(readStoredMode);
  const theme = useTheme();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.colors.paper }}>
      <Box sx={{ flex: 1 }}>
        <Box sx={{ px: 4, py: 3 }}>
          <PatchdbAppNav mode={mode} onModeChange={setMode} />
        </Box>
        {mode === 'syncInspector' ? <ApiInspector /> : <PlaygroundRoute />}
      </Box>
    </SafeAreaView>
  );
}

function PlaygroundRoute() {
  const boot = usePlaygroundBoot();
  const theme = useTheme();

  if (boot.bootErr) {
    return (
      <Box
        sx={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          p: 6,
          gap: 3,
        }}
      >
        <Text variant="subtitle" style={{ color: theme.colors.destructive }}>
          Playground failed to start
        </Text>
        <Text
          variant="caption"
          style={{ color: theme.colors.textSecondary, textAlign: 'center' }}
        >
          {boot.bootErr}
        </Text>
      </Box>
    );
  }

  if (!boot.sim) {
    return (
      <Box
        sx={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Spinner size="large" />
        <Text
          variant="caption"
          style={{ color: theme.colors.textSecondary }}
        >
          {boot.bootLabel}
        </Text>
      </Box>
    );
  }

  return (
    <PlaygroundShell
      sim={boot.sim}
      pulseKey={boot.pulseKey}
      linkEpoch={boot.linkEpoch}
      bumpGraph={boot.bumpGraph}
      bumpLink={boot.bumpLink}
      addClient={boot.addClient}
      removeClient={boot.removeClient}
      reset={boot.reset}
    />
  );
}

function PlaygroundShell({
  sim,
  pulseKey,
  linkEpoch,
  bumpGraph,
  bumpLink,
  addClient,
  removeClient,
  reset,
}: {
  sim: PlaygroundSim;
  pulseKey: number;
  linkEpoch: number;
  bumpGraph: () => void;
  bumpLink: () => void;
  addClient: () => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  reset: () => Promise<void>;
}) {
  const ctx = useMemo<SimContextValue>(
    () => ({
      sim,
      bumpGraph,
      bumpLink,
      addClient,
      removeClient,
      reset,
    }),
    [sim, bumpGraph, bumpLink, addClient, removeClient, reset]
  );

  return (
    <SimProvider value={ctx}>
      <Stack sx={{ flex: 1 }}>
        <PlaygroundHeader />
        <PlaygroundLayout sim={sim} pulseKey={pulseKey} linkEpoch={linkEpoch} />
      </Stack>
    </SimProvider>
  );
}
