import type { DragEvent as ReactDragEvent } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DependencyInjectionContainer } from '../../../dependency-injection/dependency-injection-container';
import { ContainerProvider } from '../../../dependency-injection/react';
import type { Entity } from '../../../patch-db/interface';
import { PatchesDbToken, useEntities } from '../../../patch-db/react';
import { SubscribablePatchesDbToken } from '../../../patch-db/subscribable';
import {
  nextShapeOrder,
  playgroundClearAllShapes,
  playgroundCreateShape,
  playgroundDeleteShape,
  playgroundRandomizeShape,
  playgroundReorderShapes,
  playgroundServerClearAllShapes,
  playgroundServerCreateShape,
  playgroundServerDeleteShape,
  playgroundServerRandomizeShape,
  playgroundServerReorderShapes,
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
import { C } from './constants';
import {
  PLAYGROUND_GRAPH_VIEW_H,
  PLAYGROUND_GRAPH_VIEW_W,
} from './playground-graph-layout';
import {
  PlaygroundTopologyGraph,
  type TopoAnimHandle,
} from './playground-topology-graph';
import { browserSqlJsInit } from './sql-js-browser';

const SERVER_NODE_ID = '__server__';

// ─── SVG Icon Components ──────────────────────────────────────────────

function IconPlus({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M10 4v12M4 10h12"
        stroke="currentColor"
        strokeWidth={2.2}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconTrash({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M6 6l1 10h6l1-10M4 6h12M8 4h4"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconShuffle({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M3 7h4l3 6h4m0-6h-4l-1.5 3M14 7l3 3-3 3"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSync({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M3 10a7 7 0 0112.9-3.7M17 10a7 7 0 01-12.9 3.7"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <path
        d="M15 3v4h-4M5 17v-4h4"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconPartition({
  active,
  size = 16,
}: {
  active: boolean;
  size?: number;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle
        cx={6}
        cy={10}
        r={3}
        stroke="currentColor"
        strokeWidth={1.6}
        fill={active ? C.red : 'none'}
        opacity={active ? 0.5 : 1}
      />
      <circle
        cx={14}
        cy={10}
        r={3}
        stroke="currentColor"
        strokeWidth={1.6}
        fill={active ? C.red : 'none'}
        opacity={active ? 0.5 : 1}
      />
      {active ? (
        <line
          x1={3}
          y1={3}
          x2={17}
          y2={17}
          stroke={C.red}
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      ) : (
        <line
          x1={9}
          y1={10}
          x2={11}
          y2={10}
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        />
      )}
    </svg>
  );
}

function IconClear({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <path
        d="M4 5l2.5 12h7L16 5"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 5h16"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
      <path
        d="M8 8v6M12 8v6"
        stroke="currentColor"
        strokeWidth={1.4}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconGrip({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 16" fill="none">
      <circle cx={4} cy={3} r={1.2} fill="currentColor" opacity={0.5} />
      <circle cx={8} cy={3} r={1.2} fill="currentColor" opacity={0.5} />
      <circle cx={4} cy={8} r={1.2} fill="currentColor" opacity={0.5} />
      <circle cx={8} cy={8} r={1.2} fill="currentColor" opacity={0.5} />
      <circle cx={4} cy={13} r={1.2} fill="currentColor" opacity={0.5} />
      <circle cx={8} cy={13} r={1.2} fill="currentColor" opacity={0.5} />
    </svg>
  );
}

function IconRemove({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
      <circle cx={10} cy={10} r={8} stroke="currentColor" strokeWidth={1.5} />
      <path
        d="M7 7l6 6M13 7l-6 6"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconServer({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect
        x={3}
        y={2}
        width={18}
        height={7}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <rect
        x={3}
        y={11}
        width={18}
        height={7}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <circle cx={17} cy={5.5} r={1} fill={C.green} />
      <circle cx={17} cy={14.5} r={1} fill={C.green} />
      <path
        d="M8 20h8M12 18v2"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconLaptop({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect
        x={3}
        y={4}
        width={18}
        height={12}
        rx={2}
        stroke="currentColor"
        strokeWidth={1.5}
      />
      <path
        d="M1 18h22"
        stroke="currentColor"
        strokeWidth={1.8}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ─── Teardown ─────────────────────────────────────────────────────────

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

// ─── Shared Styles ────────────────────────────────────────────────────

const cardChrome =
  'rounded-xl border border-white/15 bg-black/70 shadow-xl backdrop-blur-md overflow-hidden';

const btnSmall =
  'flex items-center justify-center rounded-md p-1 text-white/60 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30';

const btnAction =
  'flex items-center gap-1.5 rounded-lg border border-white/15 bg-white/8 px-3 py-1.5 text-xs font-semibold text-white/85 hover:bg-white/14 transition-colors disabled:opacity-35';

// ─── Shape Row (colocated actions + DnD) ──────────────────────────────

function ShapeRow({
  entity,
  index,
  busy,
  onRandomize,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
}: {
  entity: Entity;
  index: number;
  busy: boolean;
  onRandomize: (entityId: string) => void;
  onDelete: (entityId: string) => void;
  onDragStart: (e: ReactDragEvent, index: number) => void;
  onDragOver: (e: ReactDragEvent, index: number) => void;
  onDrop: (e: ReactDragEvent, index: number) => void;
}) {
  return (
    <li
      draggable
      onDragStart={(e) => onDragStart(e, index)}
      onDragOver={(e) => onDragOver(e, index)}
      onDrop={(e) => onDrop(e, index)}
      className="group flex items-center gap-1.5 rounded-lg border border-transparent px-1 py-0.5 transition-colors hover:border-white/10 hover:bg-white/5"
    >
      <span className="cursor-grab text-white/25 active:cursor-grabbing">
        <IconGrip />
      </span>
      <span className="w-5 shrink-0 text-center text-[0.6rem] text-white/35 font-mono">
        {String(entity.attributes[SHAPE_ATTR.order] ?? index)}
      </span>
      <svg
        viewBox="0 0 100 100"
        className="h-6 w-6 shrink-0 rounded border border-white/10 bg-black/40"
      >
        <polygon
          points={String(entity.attributes[SHAPE_ATTR.points] ?? '')}
          fill={String(entity.attributes[SHAPE_ATTR.fill] ?? '#666')}
          stroke="rgba(255,255,255,0.12)"
          strokeWidth={0.5}
        />
      </svg>
      <span className="min-w-0 flex-1 truncate font-mono text-[0.65rem] text-white/65">
        {String(entity.attributes[SHAPE_ATTR.kind] ?? '')}
      </span>
      <button
        type="button"
        disabled={busy}
        onClick={() => onRandomize(entity.entityId)}
        className={btnSmall}
        title="Randomize shape"
      >
        <IconShuffle />
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => onDelete(entity.entityId)}
        className={`${btnSmall} hover:text-red-400`}
        title="Delete shape"
      >
        <IconTrash />
      </button>
    </li>
  );
}

// ─── Server Node Panel ────────────────────────────────────────────────

function ServerNodePanel({
  sim,
  onGraphPulse,
  topoRef,
}: {
  sim: PlaygroundSim;
  onGraphPulse: () => void;
  topoRef: React.RefObject<TopoAnimHandle | null>;
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
        setNote(
          `Read failed: ${err instanceof Error ? err.message : String(err)}`
        );
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
        if (r === false) setNote('Nothing to act on (empty list).');
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

  const animatePollAll = useCallback(() => {
    for (const c of sim.clients) {
      setTimeout(
        () => topoRef.current?.animateMessage(SERVER_NODE_ID, c.id),
        Math.random() * 150
      );
    }
  }, [sim.clients, topoRef]);

  const handleRandomize = useCallback(
    (entityId: string) =>
      run(async () => {
        await playgroundServerRandomizeShape(sim, entityId);
        animatePollAll();
      }),
    [run, sim, animatePollAll]
  );

  const handleDelete = useCallback(
    (entityId: string) =>
      run(async () => {
        await playgroundServerDeleteShape(sim, entityId);
        animatePollAll();
      }),
    [run, sim, animatePollAll]
  );

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const handleDragStart = useCallback(
    (_e: ReactDragEvent, idx: number) => setDragIdx(idx),
    []
  );
  const handleDragOver = useCallback(
    (e: ReactDragEvent, _idx: number) => e.preventDefault(),
    []
  );
  const handleDrop = useCallback(
    (_e: ReactDragEvent, dropIdx: number) => {
      if (dragIdx === null || dragIdx === dropIdx) return;
      const reordered = [...entities];
      const [moved] = reordered.splice(dragIdx, 1);
      if (moved) {
        reordered.splice(dropIdx, 0, moved);
        void run(async () => {
          await playgroundServerReorderShapes(
            sim,
            reordered.map((e) => e.entityId)
          );
          animatePollAll();
        });
      }
      setDragIdx(null);
    },
    [dragIdx, entities, run, sim, animatePollAll]
  );

  return (
    <div className={cardChrome}>
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className="text-violet-400">
          <IconServer />
        </span>
        <span className="font-mono text-sm font-semibold text-white/90">
          {sim.serverId}
        </span>
        <span className="ml-auto text-[0.65rem] text-white/35">authority</span>
      </div>

      <div className="p-3">
        <div className="mb-2 flex items-center gap-2">
          <span className="text-[0.7rem] text-white/45">
            {entities.length} shape(s)
          </span>
          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await playgroundServerClearAllShapes(sim, entities);
                animatePollAll();
              })
            }
            className={`${btnSmall} ml-auto`}
            title="Clear all shapes"
          >
            <IconClear />
          </button>
        </div>

        {entities.length === 0 ? (
          <p className="py-2 text-center text-[0.7rem] text-white/30">
            No shapes
          </p>
        ) : (
          <ol className="max-h-48 space-y-0.5 overflow-y-auto overscroll-contain pr-1 text-[0.72rem]">
            {entities.map((e, i) => (
              <ShapeRow
                key={e.entityId}
                entity={e}
                index={i}
                busy={busy}
                onRandomize={handleRandomize}
                onDelete={handleDelete}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
          </ol>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await playgroundServerCreateShape(sim, nextShapeOrder(entities));
              animatePollAll();
            })
          }
          className={`${btnAction} mt-2 w-full justify-center`}
        >
          <IconPlus size={14} />
          Create shape
        </button>

        {note ? (
          <p className="mt-1.5 text-[0.7rem] text-amber-300">{note}</p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Client Node Panel ────────────────────────────────────────────────

function ClientNodePanel({
  client,
  sim,
  onGraphPulse,
  onLinkChange,
  onRemove,
  topoRef,
}: {
  client: PlaygroundClientHandle;
  sim: PlaygroundSim;
  onGraphPulse: () => void;
  onLinkChange: () => void;
  onRemove: (id: string) => void;
  topoRef: React.RefObject<TopoAnimHandle | null>;
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
        if (r === false) setNote('Nothing to act on (empty list).');
        onGraphPulse();
      } catch (err) {
        setNote(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [onGraphPulse]
  );

  const animatePush = useCallback(() => {
    topoRef.current?.animateMessage(client.id, SERVER_NODE_ID);
    setTimeout(() => {
      for (const c of sim.clients) {
        topoRef.current?.animateMessage(SERVER_NODE_ID, c.id);
      }
    }, 350);
  }, [client.id, sim.clients, topoRef]);

  const handleRandomize = useCallback(
    (entityId: string) =>
      run(async () => {
        await playgroundRandomizeShape(sim, client.id, entityId);
        animatePush();
      }),
    [run, sim, client.id, animatePush]
  );

  const handleDelete = useCallback(
    (entityId: string) =>
      run(async () => {
        await playgroundDeleteShape(sim, client.id, entityId);
        animatePush();
      }),
    [run, sim, client.id, animatePush]
  );

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const handleDragStart = useCallback(
    (_e: ReactDragEvent, idx: number) => setDragIdx(idx),
    []
  );
  const handleDragOver = useCallback(
    (e: ReactDragEvent, _idx: number) => e.preventDefault(),
    []
  );
  const handleDrop = useCallback(
    (_e: ReactDragEvent, dropIdx: number) => {
      if (dragIdx === null || dragIdx === dropIdx) return;
      const reordered = [...entities];
      const [moved] = reordered.splice(dragIdx, 1);
      if (moved) {
        reordered.splice(dropIdx, 0, moved);
        void run(async () => {
          await playgroundReorderShapes(
            sim,
            client.id,
            reordered.map((e) => e.entityId)
          );
          animatePush();
        });
      }
      setDragIdx(null);
    },
    [dragIdx, entities, run, sim, client.id, animatePush]
  );

  return (
    <div
      className={`${cardChrome} ${partitioned ? 'ring-1 ring-red-500/40' : ''}`}
    >
      <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2">
        <span className={partitioned ? 'text-red-400' : 'text-teal-400'}>
          <IconLaptop />
        </span>
        <span className="font-mono text-sm font-semibold text-white/90">
          {client.id}
        </span>
        {partitioned && (
          <span className="rounded bg-red-950/80 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase text-red-400">
            offline
          </span>
        )}
        <button
          type="button"
          onClick={() => onRemove(client.id)}
          className={`${btnSmall} ml-auto hover:text-red-400`}
          title="Remove client"
        >
          <IconRemove />
        </button>
      </div>

      <div className="p-3">
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
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
            className={`${btnAction} ${
              partitioned
                ? 'border-red-400/50 bg-red-950/40 text-red-200'
                : ''
            }`}
          >
            <IconPartition active={partitioned} size={14} />
            {partitioned ? 'Reconnect' : 'Partition'}
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await sim.syncNow(client.id);
                animatePush();
              })
            }
            className={btnAction}
          >
            <IconSync size={14} />
            Sync
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={() =>
              run(async () => {
                await playgroundClearAllShapes(sim, client.id, entities);
                animatePush();
              })
            }
            className={btnSmall}
            title="Clear all shapes"
          >
            <IconClear />
          </button>
        </div>

        <p className="mb-1.5 text-[0.65rem] text-white/40">
          {entities.length} shape(s)
        </p>

        {entities.length === 0 ? (
          <p className="py-2 text-center text-[0.7rem] text-white/30">
            No shapes
          </p>
        ) : (
          <ol className="max-h-48 space-y-0.5 overflow-y-auto overscroll-contain pr-1 text-[0.72rem]">
            {entities.map((e, i) => (
              <ShapeRow
                key={e.entityId}
                entity={e}
                index={i}
                busy={busy}
                onRandomize={handleRandomize}
                onDelete={handleDelete}
                onDragStart={handleDragStart}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              />
            ))}
          </ol>
        )}

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await playgroundCreateShape(
                sim,
                client.id,
                nextShapeOrder(entities)
              );
              animatePush();
            })
          }
          className={`${btnAction} mt-2 w-full justify-center`}
        >
          <IconPlus size={14} />
          Create shape
        </button>

        {note ? (
          <p className="mt-1.5 text-[0.7rem] text-amber-300">{note}</p>
        ) : null}
      </div>
    </div>
  );
}

// ─── Client DI Wrapper ────────────────────────────────────────────────

function PlaygroundClientProviders({
  client,
  sim,
  onGraphPulse,
  onLinkChange,
  onRemove,
  topoRef,
}: {
  client: PlaygroundClientHandle;
  sim: PlaygroundSim;
  onGraphPulse: () => void;
  onLinkChange: () => void;
  onRemove: (id: string) => void;
  topoRef: React.RefObject<TopoAnimHandle | null>;
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
        onGraphPulse={onGraphPulse}
        onLinkChange={onLinkChange}
        onRemove={onRemove}
        topoRef={topoRef}
      />
    </ContainerProvider>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────

export function PlaygroundApp() {
  const [sim, setSim] = useState<PlaygroundSim | null>(null);
  const [bootErr, setBootErr] = useState<string | null>(null);
  const [bootLabel, setBootLabel] = useState('Starting sql.js + sync stack…');
  const [pulseKey, setPulseKey] = useState(0);
  const [linkEpoch, setLinkEpoch] = useState(0);
  const [clientEpoch, setClientEpoch] = useState(0);
  const simRef = useRef<PlaygroundSim | null>(null);
  const topoRef = useRef<TopoAnimHandle | null>(null);

  const bumpGraph = useCallback(() => setPulseKey((k) => k + 1), []);
  const bumpLink = useCallback(() => {
    setLinkEpoch((e) => e + 1);
    setPulseKey((k) => k + 1);
  }, []);

  const handleAddClient = useCallback(async () => {
    if (!sim) return;
    await sim.addClient();
    setClientEpoch((e) => e + 1);
    setPulseKey((k) => k + 1);
  }, [sim]);

  const handleRemoveClient = useCallback(
    async (id: string) => {
      if (!sim) return;
      if (sim.clients.length <= 1) return;
      await sim.removeClient(id);
      setClientEpoch((e) => e + 1);
      setPulseKey((k) => k + 1);
    },
    [sim]
  );

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
        setBootLabel('Seeding shapes…');
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
      </div>
    );
  }

  if (!sim) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-2">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-white/20 border-t-violet-400" />
        <p className="text-sm text-white/70">{bootLabel}</p>
      </div>
    );
  }

  /* eslint-disable @typescript-eslint/no-unused-vars */
  const _clientEpoch = clientEpoch;
  /* eslint-enable @typescript-eslint/no-unused-vars */

  return (
    <div className="flex h-screen min-h-0 flex-col overflow-hidden bg-(--pg-bg) text-white">
      {/* Header */}
      <header className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2">
        <h1 className="font-display text-lg font-semibold tracking-tight text-white/90">
          Patch Playground
        </h1>
        <span className="rounded bg-white/8 px-2 py-0.5 font-mono text-[0.65rem] text-white/50">
          {SHAPE_ENTITY_TYPE} / {sim.serverId}
        </span>
        <button
          type="button"
          onClick={handleAddClient}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-teal-500/30 bg-teal-950/30 px-3 py-1.5 text-xs font-semibold text-teal-300 transition-colors hover:bg-teal-900/40"
        >
          <IconPlus size={14} />
          Add Client
        </button>
      </header>

      {/* Topology Graph */}
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

      {/* Node Panels */}
      <section className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-5xl gap-4 grid-cols-[repeat(auto-fill,minmax(260px,1fr))]">
          <ServerNodePanel
            sim={sim}
            onGraphPulse={bumpGraph}
            topoRef={topoRef}
          />
          {sim.clients.map((c) => (
            <PlaygroundClientProviders
              key={c.id}
              client={c}
              sim={sim}
              onGraphPulse={bumpGraph}
              onLinkChange={bumpLink}
              onRemove={handleRemoveClient}
              topoRef={topoRef}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
