import { useCallback, useMemo, useState } from 'react';
import { DependencyInjectionContainer } from '../dependency-injection/dependency-injection-container';
import { ContainerProvider } from '../dependency-injection/react';
import { PatchesDbToken, useEntities } from '../patch-db/react';
import {
  nextShapeOrder,
  playgroundCreateShape,
  playgroundDeleteShape,
  playgroundRandomizeShape,
  playgroundReorderShapes,
  shapeListQuery,
} from '../patch-db/sim/playground-shapes';
import type { PlaygroundClientHandle } from '../patch-db/sim/playground-sim';
import { SubscribablePatchesDbToken } from '../patch-db/subscribable';
import { IconLaptop, IconPartition, IconSync } from './icons';
import { NodePanelShell } from './node-panel-shell';
import { ShapeList } from './shape-list';
import { useSimContext } from './sim-context';
import { btnAction, btnTiny } from './styles';
import { useAsyncAction } from './use-async-action';
import { useDragReorder } from './use-drag-reorder';
import { useClientTopoAnimation } from './use-topo-animation';

const LATENCY_BUCKETS: { value: number; label: string }[] = [
  { value: 0, label: '0ms' },
  { value: 50, label: '50ms' },
  { value: 150, label: '150ms' },
  { value: 500, label: '500ms' },
  { value: 1000, label: '1s' },
  { value: 2000, label: '2s' },
  { value: 5000, label: '5s' },
];

function ClientNodePanelInner({ client }: { client: PlaygroundClientHandle }) {
  const { sim, topoRef, bumpGraph, bumpLink, removeClient } = useSimContext();

  const shapeQuery = useMemo(() => shapeListQuery(), []);
  const { entities } = useEntities(shapeQuery);
  const [latencyMs, setLatencyMs] = useState(() => {
    const raw = client.link.getLatency();
    const closest = LATENCY_BUCKETS.reduce((prev, cur) =>
      Math.abs(cur.value - raw) < Math.abs(prev.value - raw) ? cur : prev
    );
    return closest.value;
  });
  const partitioned = client.link.isPartitioned();

  const animatePush = useClientTopoAnimation(client, sim, topoRef);
  const { busy, note, run } = useAsyncAction(bumpGraph);

  const handleLatencyChange = useCallback(
    (ms: number) => {
      setLatencyMs(ms);
      client.link.setLatency(ms);
    },
    [client.link]
  );

  const handleRandomize = useCallback(
    (entityId: string) =>
      run(async () => {
        animatePush();
        await playgroundRandomizeShape(sim, client.id, entityId);
      }),
    [run, sim, client.id, animatePush]
  );

  const handleDelete = useCallback(
    (entityId: string) =>
      run(async () => {
        animatePush();
        await playgroundDeleteShape(sim, client.id, entityId);
      }),
    [run, sim, client.id, animatePush]
  );

  const handleCreate = useCallback(
    () =>
      run(async () => {
        animatePush();
        await playgroundCreateShape(sim, client.id, nextShapeOrder(entities));
      }),
    [run, sim, client.id, entities, animatePush]
  );

  const handleReorder = useCallback(
    (entityIds: string[]) => {
      void run(async () => {
        animatePush();
        await playgroundReorderShapes(sim, client.id, entityIds);
      });
    },
    [run, sim, client.id, animatePush]
  );

  const { handleDragStart, handleDragOver, handleDrop } = useDragReorder(
    entities,
    handleReorder
  );

  return (
    <NodePanelShell
      icon={<IconLaptop />}
      iconColor={partitioned ? 'text-red-400' : 'text-teal-400'}
      title={client.id}
      partitioned={partitioned}
      headerExtra={
        <>
          {partitioned && (
            <span className="rounded bg-red-950/80 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase text-red-400">
              offline
            </span>
          )}
          <button
            type="button"
            onClick={() => removeClient(client.id)}
            className={`${btnTiny} ml-auto hover:text-red-400`}
          >
            Remove
          </button>
        </>
      }
    >
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
              bumpLink();
            })
          }
          className={`${btnAction} ${
            partitioned ? 'border-red-400/50 bg-red-950/40 text-red-200' : ''
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
              animatePush();
              await sim.syncNow(client.id);
            })
          }
          className={btnAction}
        >
          <IconSync size={14} />
          Sync
        </button>

        <select
          value={latencyMs}
          onChange={(e) => handleLatencyChange(Number(e.target.value))}
          className={`${btnAction} appearance-none bg-white/8 pr-5 cursor-pointer`}
        >
          {LATENCY_BUCKETS.map((b) => (
            <option key={b.value} value={b.value}>
              {b.label}
            </option>
          ))}
        </select>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await sim.wipeClientDb(client.id);
            })
          }
          className={`${btnAction} hover:text-red-400`}
        >
          Wipe
        </button>

        <button
          type="button"
          disabled={busy || entities.length === 0}
          onClick={() =>
            run(async () => {
              animatePush();
              for (const e of entities) {
                await playgroundRandomizeShape(sim, client.id, e.entityId);
              }
            })
          }
          className={btnAction}
        >
          Shuffle
        </button>
      </div>

      <p className="mb-1.5 text-[0.65rem] text-white/40">
        {entities.length} shape(s)
      </p>

      <ShapeList
        entities={entities}
        busy={busy}
        note={note}
        onRandomize={handleRandomize}
        onDelete={handleDelete}
        onCreate={handleCreate}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
      />
    </NodePanelShell>
  );
}

/**
 * DI wrapper: each client gets its own container so `useEntities`
 * reads from the correct local SyncPatchesDb.
 */
export function ClientNodePanel({
  client,
}: {
  client: PlaygroundClientHandle;
}) {
  const container = useMemo(() => {
    const c = new DependencyInjectionContainer();
    c.registerValue(PatchesDbToken, client.syncDb);
    c.registerValue(SubscribablePatchesDbToken, client.syncDb);
    return c;
  }, [client.syncDb]);

  return (
    <ContainerProvider container={container}>
      <ClientNodePanelInner client={client} />
    </ContainerProvider>
  );
}
