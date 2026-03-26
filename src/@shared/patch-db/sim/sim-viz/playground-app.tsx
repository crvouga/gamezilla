import { useMemo } from 'react';
import type { PlaygroundSim } from '../playground-sim';
import { ClientNodePanel } from './client-node-panel';
import { PlaygroundHeader } from './playground-header';
import {
  PLAYGROUND_GRAPH_VIEW_H,
  PLAYGROUND_GRAPH_VIEW_W,
} from './playground-graph-layout';
import { PlaygroundTopologyGraph } from './playground-topology-graph';
import type { TopoAnimHandle } from './playground-topology-graph';
import { ServerNodePanel } from './server-node-panel';
import { SimProvider, type SimContextValue } from './sim-context';
import { usePlaygroundBoot } from './use-playground-boot';

export function PlaygroundApp() {
  const boot = usePlaygroundBoot();

  if (boot.bootErr) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold text-red-300">
          Playground failed to start
        </p>
        <p className="max-w-md text-sm text-white/55">{boot.bootErr}</p>
      </div>
    );
  }

  if (!boot.sim) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-violet-400" />
        <p className="text-sm text-white/70">{boot.bootLabel}</p>
      </div>
    );
  }

  return (
    <PlaygroundShell
      sim={boot.sim}
      topoRef={boot.topoRef}
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
  topoRef,
  pulseKey,
  linkEpoch,
  bumpGraph,
  bumpLink,
  addClient,
  removeClient,
  reset,
}: {
  sim: PlaygroundSim;
  topoRef: React.RefObject<TopoAnimHandle | null>;
  pulseKey: number;
  linkEpoch: number;
  bumpGraph: () => void;
  bumpLink: () => void;
  addClient: () => Promise<void>;
  removeClient: (id: string) => Promise<void>;
  reset: () => Promise<void>;
}) {
  const ctx = useMemo<SimContextValue>(
    () => ({ sim, topoRef, bumpGraph, bumpLink, addClient, removeClient, reset }),
    [sim, topoRef, bumpGraph, bumpLink, addClient, removeClient, reset]
  );

  return (
    <SimProvider value={ctx}>
      <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-(--pg-bg) text-white">
        <PlaygroundHeader />

        <section className="shrink-0 border-b border-white/8 px-4 py-3">
          <div
            className="mx-auto"
            style={{
              maxWidth: 640,
              aspectRatio: `${PLAYGROUND_GRAPH_VIEW_W} / ${PLAYGROUND_GRAPH_VIEW_H}`,
            }}
          >
            <PlaygroundTopologyGraph
              ref={topoRef}
              sim={sim}
              pulseKey={pulseKey}
              linkEpoch={linkEpoch}
            />
          </div>
        </section>

        <section className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="mx-auto grid max-w-5xl gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
            <ServerNodePanel />
            {sim.clients.map((c) => (
              <ClientNodePanel key={c.id} client={c} />
            ))}
          </div>
        </section>
      </div>
    </SimProvider>
  );
}
