import type { PlaygroundSim } from '@pkgs/patch-db/sim/playground-sim';
import { Box, ErrorState, LoadingState, Stack, useTheme } from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import { useMemo, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiInspector } from './api-inspector';
import { PatchdbAppNav, readStoredMode, type PatchdbAppMode } from './nav';
import { PlaygroundHeader } from './playground-header';
import { PlaygroundLayout } from './playground-layout';
import { SimProvider, type SimContextValue } from './sim-context';
import { usePlaygroundBoot } from './use-playground-boot';

export function PlaygroundApp() {
  const [mode, setMode] = useState<PatchdbAppMode>(readStoredMode);
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Box
      style={{
        flex: 1,
        backgroundColor: theme.colors.surface,
        paddingBottom: insets.bottom,
      }}
    >
      <Box sx={{ flex: 1 }}>
        <Box sx={{ px: 4, py: 3 }}>
          <PatchdbAppNav mode={mode} onModeChange={setMode} />
        </Box>
        {mode === 'syncInspector' ? <ApiInspector /> : <PlaygroundRoute />}
      </Box>
    </Box>
  );
}

function PlaygroundRoute() {
  const { t } = useLingui();
  const boot = usePlaygroundBoot();

  if (boot.bootErr) {
    return (
      <ErrorState title={t`Playground failed to start`} body={boot.bootErr} />
    );
  }

  if (!boot.sim) {
    return <LoadingState caption={boot.bootLabel} />;
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
