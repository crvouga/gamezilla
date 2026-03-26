import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DependencyInjectionContainer } from '../../../dependency-injection/dependency-injection-container';
import { ContainerProvider } from '../../../dependency-injection/react';
import type { Entity } from '../../../patch-db/interface';
import { PatchesDbToken, useEntities } from '../../../patch-db/react';
import { SubscribablePatchesDbToken } from '../../../patch-db/subscribable';
import {
  nextShapeOrder,
  playgroundCreateShape,
  playgroundServerCreateShape,
  playgroundServerSoftDeleteRandomShape,
  playgroundServerUpdateRandomShape,
  playgroundSoftDeleteRandomShape,
  playgroundUpdateRandomShape,
  seedPlaygroundShapes,
  SHAPE_ATTR,
  SHAPE_ENTITY_TYPE,
  shapeListQuery,
} from '../playground-shapes';
import {
  createPlaygroundSim,
  type PlaygroundClientHandle,
  type PlaygroundSim,
} from '../playground-sim';
import {
  PLAYGROUND_GRAPH_VIEW_H,
  PLAYGROUND_GRAPH_VIEW_W,
  playgroundGraphClientAnchors,
  playgroundGraphServerAnchor,
} from './playground-graph-layout';
import { PlaygroundTopologyGraph } from './playground-topology-graph';
import { browserSqlJsInit } from './sql-js-browser';

/**
 * Serialize `destroy()` across remounts so HMR never runs two sims on one sql.js heap.
 * Uses a global Symbol key so the promise survives Vite module re-evaluation on HMR.
 */
const SIM_TEARDOWN_KEY = Symbol.for('playground-sim-teardown');
function getSimTeardown(): Promise<void> {
  return (
    (globalThis as unknown as Record<symbol, Promise<void>>)[
      SIM_TEARDOWN_KEY
    ] ?? Promise.resolve()
  );
}
function setSimTeardown(p: Promise<void>): void {
  (globalThis as unknown as Record<symbol, Promise<void>>)[SIM_TEARDOWN_KEY] =
    p;
}

/** Anchor to graph node center (circle); row extends right from the node with a small gap. */
function nodePanelsRowStyle(anchor: { x: number; y: number }): CSSProperties {
  return {
    position: 'absolute',
    left: `${(anchor.x / PLAYGROUND_GRAPH_VIEW_W) * 100}%`,
    top: `${(anchor.y / PLAYGROUND_GRAPH_VIEW_H) * 100}%`,
    transform: 'translate(12px, -50%)',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: '0.5rem',
  };
}

const listPanelChrome =
  'w-[min(200px,38vw)] shrink-0 rounded-xl border border-white/20 bg-black/75 p-2 shadow-xl backdrop-blur-md';
const actionPanelChrome =
  'w-[min(200px,38vw)] shrink-0 rounded-xl border border-white/20 bg-black/70 p-2 shadow-xl backdrop-blur-md';

function OrderedShapeList({ entities }: { entities: Entity[] }) {
  if (entities.length === 0) {
    return <p className="text-[0.7rem] text-white/40">No rows.</p>;
  }
  return (
    <ol className="max-h-40 space-y-1.5 overflow-y-auto overscroll-contain pl-0 text-[0.72rem] text-white/80">
      {entities.map((e) => (
        <li key={e.entityId} className="flex items-center gap-2">
          <span className="w-7 shrink-0 text-white/45">
            {String(e.attributes[SHAPE_ATTR.order] ?? '')}
          </span>
          <svg
            viewBox="0 0 100 100"
            className="h-7 w-7 shrink-0 rounded border border-white/10 bg-black/40"
          >
            <polygon
              points={String(e.attributes[SHAPE_ATTR.points] ?? '')}
              fill={String(e.attributes[SHAPE_ATTR.fill] ?? '#666')}
              stroke="rgba(255,255,255,0.12)"
              strokeWidth={0.35}
            />
          </svg>
          <span className="min-w-0 truncate font-mono text-[0.65rem]">
            {String(e.attributes[SHAPE_ATTR.kind] ?? '')}
          </span>
        </li>
      ))}
    </ol>
  );
}

function ServerNodePanel({
  sim,
  onGraphPulse,
}: {
  sim: PlaygroundSim;
  onGraphPulse: () => void;
}) {
  const shapeQuery = useMemo(() => shapeListQuery(), []);
  const [entities, setEntities] = useState<Entity[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void sim.serverBacking
      .read([shapeQuery])
      .then((r) => {
        setEntities(r[0]?.entities ?? []);
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        setNote(`Read failed: ${msg}`);
        setEntities([]);
      });
  }, [sim, shapeQuery]);

  useEffect(() => {
    refresh();
    const id = window.setInterval(refresh, 900);
    return () => clearInterval(id);
  }, [refresh]);

  const run = useCallback(
    async (fn: () => Promise<void | boolean>) => {
      setBusy(true);
      setNote(null);
      try {
        const r = await fn();
        if (r === false) setNote('Nothing to update (empty list).');
        refresh();
        onGraphPulse();
      } catch (err) {
        setNote(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [onGraphPulse, refresh]
  );

  const anchor = playgroundGraphServerAnchor;

  return (
    <div className="pointer-events-auto" style={nodePanelsRowStyle(anchor)}>
      <div className={listPanelChrome}>
        <div className="mb-1 border-b border-white/10 pb-1 font-mono text-[0.7rem] font-semibold text-white/90">
          {sim.serverId} — local DB
        </div>
        <p className="mb-1 text-[0.65rem] text-white/45">
          {entities.length} live shape(s) on authority DB
        </p>
        <OrderedShapeList entities={entities} />
      </div>
      <div className={actionPanelChrome}>
        <div className="mb-1 border-b border-white/10 pb-1 font-mono text-[0.7rem] text-white/80">
          {sim.serverId} — actions
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() =>
                playgroundServerCreateShape(sim, nextShapeOrder(entities))
              )
            }
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40"
          >
            Create
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => playgroundServerUpdateRandomShape(sim, entities))
            }
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40"
          >
            Update rnd
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => playgroundServerSoftDeleteRandomShape(sim, entities))
            }
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40"
          >
            Delete rnd
          </button>
        </div>
        {note ? (
          <p className="mt-1.5 text-[0.7rem] text-amber-300">{note}</p>
        ) : null}
      </div>
    </div>
  );
}

function ClientNodePanel({
  client,
  sim,
  anchor,
  onGraphPulse,
  onLinkChange,
}: {
  client: PlaygroundClientHandle;
  sim: PlaygroundSim;
  anchor: { x: number; y: number };
  onGraphPulse: () => void;
  onLinkChange: () => void;
}) {
  const shapeQuery = useMemo(() => shapeListQuery(), []);
  const { entities } = useEntities(shapeQuery);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const partitioned = client.link.isPartitioned();

  const run = useCallback(
    async (fn: () => Promise<void | boolean>) => {
      setBusy(true);
      setNote(null);
      try {
        const r = await fn();
        if (r === false) setNote('Nothing to update (empty list).');
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
    <div className="pointer-events-auto" style={nodePanelsRowStyle(anchor)}>
      <div className={listPanelChrome}>
        <div className="mb-1 border-b border-white/10 pb-1 font-mono text-[0.7rem] font-semibold text-white/90">
          {client.id} — local DB
        </div>
        <p className="mb-1 text-[0.65rem] text-white/45">
          {entities.length} local shape(s)
        </p>
        <OrderedShapeList entities={entities} />
      </div>
      <div className={actionPanelChrome}>
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-1">
          <span className="font-mono text-[0.7rem] text-white/80">
            {client.id} — actions
          </span>
          {partitioned ? (
            <span className="rounded bg-red-950/80 px-1.5 py-0.5 text-[0.6rem] font-bold uppercase text-red-400">
              partitioned
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() =>
                playgroundCreateShape(sim, client.id, nextShapeOrder(entities))
              )
            }
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40"
          >
            Create
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() => playgroundUpdateRandomShape(sim, client.id, entities))
            }
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40"
          >
            Update rnd
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(() =>
                playgroundSoftDeleteRandomShape(sim, client.id, entities)
              )
            }
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40"
          >
            Delete rnd
          </button>
          <button
            type="button"
            role="switch"
            aria-checked={partitioned}
            disabled={busy}
            onClick={() =>
              run(async () => {
                if (client.link.isPartitioned()) {
                  client.link.heal();
                } else {
                  client.link.partition();
                }
                onLinkChange();
              })
            }
            className={`rounded-lg border px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40 ${
              partitioned
                ? 'border-red-400/60 bg-red-950/50 text-red-100'
                : 'border-white/20 bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            Partition {partitioned ? 'on' : 'off'}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await sim.syncNow(client.id);
              })
            }
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-semibold text-white hover:bg-white/15 disabled:opacity-40"
          >
            Sync
          </button>
        </div>
        {note ? (
          <p className="mt-1.5 text-[0.7rem] text-amber-300">{note}</p>
        ) : null}
      </div>
    </div>
  );
}

function PlaygroundClientProviders({
  client,
  sim,
  anchor,
  onGraphPulse,
  onLinkChange,
}: {
  client: PlaygroundClientHandle;
  sim: PlaygroundSim;
  anchor: { x: number; y: number };
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
      <ClientNodePanel
        client={client}
        sim={sim}
        anchor={anchor}
        onGraphPulse={onGraphPulse}
        onLinkChange={onLinkChange}
      />
    </ContainerProvider>
  );
}

export function PlaygroundApp() {
  const [sim, setSim] = useState<PlaygroundSim | null>(null);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [bootLabel, setBootLabel] = useState('Starting sql.js + sync stack…');
  const [pulseKey, setPulseKey] = useState(0);
  const [linkEpoch, setLinkEpoch] = useState(0);
  const simRef = useRef<PlaygroundSim | null>(null);

  const clientAnchors = useMemo(
    () => (sim ? playgroundGraphClientAnchors(sim.clients.length) : []),
    [sim]
  );

  const bumpGraph = useCallback(() => {
    setPulseKey((k) => k + 1);
  }, []);

  const bumpLink = useCallback(() => {
    setLinkEpoch((e) => e + 1);
    setPulseKey((k) => k + 1);
  }, []);

  useEffect(() => {
    let mounted = true;
    setBootErr(null);
    setBootLabel('Starting sql.js + sync stack…');
    void (async () => {
      await getSimTeardown();
      if (!mounted) return;
      setSim(null);
      try {
        const p = await createPlaygroundSim({
          clientCount: 2,
          sqlJs: browserSqlJsInit,
        });
        if (!mounted) {
          await p.destroy();
          return;
        }
        simRef.current = p;
        setBootLabel('seedPlaygroundShapes…');
        try {
          await seedPlaygroundShapes(p, { shapesPerClient: 2 });
        } catch (e) {
          simRef.current = null;
          if (!mounted) {
            await p.destroy();
            return;
          }
          setBootErr(e instanceof Error ? e.message : String(e));
          await p.destroy();
          return;
        }
        if (!mounted) {
          simRef.current = null;
          await p.destroy();
          return;
        }
        setSim(p);
        setPulseKey((k) => k + 1);
      } catch (e: unknown) {
        if (!mounted) return;
        setBootErr(e instanceof Error ? e.message : String(e));
      }
    })();
    return () => {
      mounted = false;
      const x = simRef.current;
      simRef.current = null;
      const prev = getSimTeardown();
      setSimTeardown(
        prev.then(() =>
          x !== null && x !== undefined ? x.destroy() : Promise.resolve()
        )
      );
    };
  }, []);

  if (bootErr) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-lg font-semibold text-red-300">
          Playground failed to start
        </p>
        <p className="max-w-md text-sm text-white/55">{bootErr}</p>
        <p className="text-sm text-white/40">
          Try <code className="text-cyan-300">bun run viz:serve</code> if WASM
          acts up.
        </p>
      </div>
    );
  }

  if (!sim) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2">
        <p className="text-sm text-white/70">{bootLabel}</p>
      </div>
    );
  }

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-(--pg-bg) text-white">
      <header className="shrink-0 border-b border-white/10 px-4 py-2">
        <h1 className="font-mono text-lg font-semibold text-white">
          playground — {SHAPE_ENTITY_TYPE} / {sim.serverId}
        </h1>
      </header>

      <div className="relative min-h-0 flex-1 p-3">
        <div
          className="relative mx-auto h-full max-h-[min(92vh,100%)] w-full max-w-[960px]"
          style={{
            aspectRatio: `${PLAYGROUND_GRAPH_VIEW_W} / ${PLAYGROUND_GRAPH_VIEW_H}`,
          }}
        >
          <PlaygroundTopologyGraph
            sim={sim}
            pulseKey={pulseKey}
            linkEpoch={linkEpoch}
          />
          <ServerNodePanel sim={sim} onGraphPulse={bumpGraph} />
          {sim.clients.map((c, i) => {
            const anchor = clientAnchors[i];
            if (!anchor) return null;
            return (
              <PlaygroundClientProviders
                key={c.id}
                client={c}
                sim={sim}
                anchor={anchor}
                onGraphPulse={bumpGraph}
                onLinkChange={bumpLink}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
