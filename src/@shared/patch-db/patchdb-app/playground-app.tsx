import { useMemo, useState } from 'react';
import type { PlaygroundSim } from '../sim/playground-sim';
import {
  PatchdbAppNav,
  readStoredMode,
  type PatchdbAppMode,
} from './patchdb-app-nav';
import { PlaygroundFlow } from './playground-flow';
import { PlaygroundHeader } from './playground-header';
import { SimProvider, type SimContextValue } from './sim-context';
import { SyncServerInspector } from './sync-server-inspector';
import { usePlaygroundBoot } from './use-playground-boot';

export function PlaygroundApp() {
  const [mode, setMode] = useState<PatchdbAppMode>(readStoredMode);

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-(--pg-bg) text-white">
      <PatchdbAppNav mode={mode} onModeChange={setMode} />
      {mode === 'syncInspector' ? (
        <SyncServerInspector />
      ) : (
        <PlaygroundRoute />
      )}
    </div>
  );
}

function PlaygroundRoute() {
  const boot = usePlaygroundBoot();

  if (boot.bootErr) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold text-red-300">
          Playground failed to start
        </p>
        <p className="max-w-md text-sm text-white/55">{boot.bootErr}</p>
      </div>
    );
  }

  if (!boot.sim) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-violet-400" />
        <p className="text-sm text-white/70">{boot.bootLabel}</p>
      </div>
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
      topoRef: { current: null },
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <PlaygroundHeader />
        <div className="min-h-0 flex-1">
          <PlaygroundFlow sim={sim} pulseKey={pulseKey} linkEpoch={linkEpoch} />
        </div>
      </div>
    </SimProvider>
  );
}
