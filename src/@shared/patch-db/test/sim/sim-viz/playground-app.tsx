import { DependencyInjectionContainer } from '@/@shared/dependency-injection/dependency-injection-container';
import { ContainerProvider } from '@/@shared/dependency-injection/react';
import type { Entity } from '@/@shared/patch-db/interface';
import { PatchesDbToken, useEntities } from '@/@shared/patch-db/react';
import { SubscribablePatchesDbToken } from '@/@shared/patch-db/subscribable';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  nextShapeOrder,
  playgroundCreateShape,
  playgroundSoftDeleteRandomShape,
  playgroundUpdateRandomShape,
  seedPlaygroundShapes,
  SHAPE_ATTR,
  shapeListQuery,
} from '../playground-shapes';
import {
  createPlaygroundSim,
  type PlaygroundClientHandle,
  type PlaygroundSim,
} from '../playground-sim';
import { PlaygroundTopologyGraph } from './playground-topology-graph';
import { browserSqlJsInit } from './sql-js-browser';

function CompactServerStrip({
  sim,
  maxThumbs,
}: {
  sim: PlaygroundSim;
  maxThumbs?: number;
}) {
  const shapeQuery = useMemo(() => shapeListQuery(), []);
  const [entities, setEntities] = useState<Entity[]>([]);
  const cap = maxThumbs ?? 14;

  const refresh = useCallback(() => {
    void sim.serverBacking.read([shapeQuery]).then((r) => {
      setEntities(r[0]?.entities ?? []);
    });
  }, [sim, shapeQuery]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 1100);
    return () => clearInterval(id);
  }, [refresh]);

  const shown = entities.slice(0, cap);

  return (
    <div className="rounded-2xl border-2 border-white/15 bg-white/5 px-3 py-2 backdrop-blur-sm">
      <div className="mb-1.5 flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-white/90">Server vault</span>
        <span className="rounded-full bg-violet-500/25 px-2 py-0.5 font-mono text-xs text-violet-100">
          {sim.serverId}
        </span>
        <span className="text-xs text-white/45">
          {entities.length} shape{entities.length === 1 ? '' : 's'}
        </span>
      </div>
      <div className="flex max-h-16 flex-wrap gap-1.5 overflow-y-auto overscroll-contain">
        {shown.map((e) => (
          <svg
            key={e.entityId}
            viewBox="0 0 100 100"
            className="h-10 w-10 shrink-0 rounded-lg border border-white/10 bg-black/30"
          >
            <polygon
              points={String(e.attributes[SHAPE_ATTR.points] ?? '')}
              fill={String(e.attributes[SHAPE_ATTR.fill] ?? '#666')}
              stroke="rgba(255,255,255,0.15)"
              strokeWidth={0.35}
            />
          </svg>
        ))}
        {entities.length > cap ? (
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-dashed border-white/20 text-xs text-white/40">
            +{entities.length - cap}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ClientControlDeck({
  client,
  sim,
  onGraphPulse,
  onLinkChange,
}: {
  client: PlaygroundClientHandle;
  sim: PlaygroundSim;
  onGraphPulse: () => void;
  onLinkChange: () => void;
}) {
  const shapeQuery = useMemo(() => shapeListQuery(), []);
  const { entities } = useEntities(shapeQuery);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const run = useCallback(
    async (fn: () => Promise<void | boolean>) => {
      setBusy(true);
      setNote(null);
      try {
        const r = await fn();
        if (r === false) setNote('Nothing to poke (empty).');
        onGraphPulse();
      } catch (err) {
        setNote(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [onGraphPulse]
  );

  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-2xl border-2 border-white/12 bg-white/5 p-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-display text-lg font-bold tracking-tight text-white">
          {client.id}
        </span>
        {client.link.isPartitioned() ? (
          <span className="rounded-full bg-red-500/30 px-2 py-0.5 text-xs font-bold uppercase text-red-100">
            link off
          </span>
        ) : (
          <span className="rounded-full bg-emerald-500/25 px-2 py-0.5 text-xs font-bold text-emerald-100">
            link on
          </span>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(() =>
              playgroundCreateShape(sim, client.id, nextShapeOrder(entities))
            )
          }
          className="rounded-2xl bg-linear-to-b from-cyan-400 to-cyan-600 px-4 py-3 text-base font-bold text-cyan-950 shadow-lg shadow-cyan-500/20 hover:brightness-110 disabled:opacity-40"
        >
          Spawn shape
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(() => playgroundUpdateRandomShape(sim, client.id, entities))
          }
          className="rounded-2xl border-2 border-amber-400/50 bg-amber-500/20 px-4 py-3 text-base font-bold text-amber-100 hover:bg-amber-500/30 disabled:opacity-40"
        >
          Chaos edit
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(() => playgroundSoftDeleteRandomShape(sim, client.id, entities))
          }
          className="rounded-2xl border-2 border-rose-400/40 bg-rose-500/15 px-4 py-3 text-base font-bold text-rose-100 hover:bg-rose-500/25 disabled:opacity-40"
        >
          Poof one
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              client.link.partition();
              onLinkChange();
            })
          }
          className="rounded-2xl border-2 border-orange-400/35 bg-orange-950/40 px-3 py-3 text-sm font-bold text-orange-100 disabled:opacity-40"
        >
          ZAP link
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              client.link.heal();
              onLinkChange();
            })
          }
          className="rounded-2xl border-2 border-teal-400/35 bg-teal-950/35 px-3 py-3 text-sm font-bold text-teal-100 disabled:opacity-40"
        >
          Fix link
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await sim.syncNow(client.id);
            })
          }
          className="rounded-2xl border-2 border-violet-400/40 bg-violet-950/40 px-4 py-3 text-base font-bold text-violet-100 disabled:opacity-40"
        >
          Sync push
        </button>
      </div>

      {note ? (
        <p className="text-sm text-amber-200/90">{note}</p>
      ) : (
        <p className="text-xs text-white/35">
          {entities.length} local shape{entities.length === 1 ? '' : 's'}
        </p>
      )}
    </div>
  );
}

function PlaygroundClientProviders({
  client,
  sim,
  onGraphPulse,
  onLinkChange,
}: {
  client: PlaygroundClientHandle;
  sim: PlaygroundSim;
  onGraphPulse: () => void;
  onLinkChange: () => void;
}) {
  const container = useMemo(() => {
    const c = new DependencyInjectionContainer();
    c.registerValue(PatchesDbToken, client.syncDb);
    c.registerValue(SubscribablePatchesDbToken, client.syncDb);
    return c;
  }, [client.syncDb]);

  return (
    <ContainerProvider container={container}>
      <ClientControlDeck
        client={client}
        sim={sim}
        onGraphPulse={onGraphPulse}
        onLinkChange={onLinkChange}
      />
    </ContainerProvider>
  );
}

export function PlaygroundApp() {
  const [sim, setSim] = useState<PlaygroundSim | null>(null);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [bootLabel, setBootLabel] = useState('Waking up the mesh…');
  const [pulseKey, setPulseKey] = useState(0);
  const [linkEpoch, setLinkEpoch] = useState(0);
  const simRef = useRef<PlaygroundSim | null>(null);

  const bumpGraph = useCallback(() => {
    setPulseKey((k) => k + 1);
  }, []);

  const bumpLink = useCallback(() => {
    setLinkEpoch((e) => e + 1);
    setPulseKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    simRef.current = null;
    setBootErr(null);
    setBootLabel('Waking up the mesh…');
    void createPlaygroundSim({ clientCount: 2, sqlJs: browserSqlJsInit }).then(
      async (p) => {
        if (!mounted) {
          await p.destroy();
          return;
        }
        simRef.current = p;
        setBootLabel('Sprinkling random shapes…');
        try {
          await seedPlaygroundShapes(p, { shapesPerClient: 2 });
        } catch (e) {
          if (!mounted) {
            await p.destroy();
            return;
          }
          setBootErr(e instanceof Error ? e.message : String(e));
          await p.destroy();
          return;
        }
        if (!mounted) {
          await p.destroy();
          return;
        }
        setSim(p);
        setPulseKey((k) => k + 1);
      },
      (e: unknown) => {
        if (!mounted) return;
        setBootErr(e instanceof Error ? e.message : String(e));
      }
    );
    return () => {
      mounted = false;
      const x = simRef.current;
      simRef.current = null;
      void x?.destroy();
    };
  }, []);

  if (bootErr) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="font-display text-2xl font-bold text-rose-300">
          Oops—playground crashed
        </p>
        <p className="max-w-md text-base text-white/55">{bootErr}</p>
        <p className="text-sm text-white/40">
          Try <code className="text-cyan-300">bun run viz:serve</code> if WASM
          acts up.
        </p>
      </div>
    );
  }

  if (!sim) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3">
        <div className="font-display animate-pulse text-2xl font-bold text-white">
          {bootLabel}
        </div>
        <p className="text-sm text-white/40">Tiny sqlite brains loading…</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-(--pg-bg) text-white">
      <header className="shrink-0 border-b border-white/10 px-4 py-3">
        <h1 className="font-display text-2xl font-bold tracking-tight text-white md:text-3xl">
          Patch playground
        </h1>
        <p className="mt-0.5 text-sm text-white/50 md:text-base">
          Smash buttons, watch the hub &amp; clients gossip. Nothing here is
          serious.
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3 md:flex-row md:gap-4 md:p-4">
        <section className="flex min-h-0 min-w-0 flex-[1.35] flex-col md:flex-[1.6]">
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-3xl border-2 border-white/10 bg-black/25 shadow-inner shadow-black/40">
            <PlaygroundTopologyGraph
              sim={sim}
              pulseKey={pulseKey}
              linkEpoch={linkEpoch}
            />
          </div>
        </section>

        <aside className="flex min-h-0 w-full shrink-0 flex-col gap-3 md:w-[min(420px,40vw)] md:max-w-md">
          <div className="max-h-[28vh] shrink-0 overflow-y-auto md:max-h-[32vh]">
            <CompactServerStrip sim={sim} />
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain pb-2">
            {sim.clients.map((c) => (
              <PlaygroundClientProviders
                key={c.id}
                client={c}
                sim={sim}
                onGraphPulse={bumpGraph}
                onLinkChange={bumpLink}
              />
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
