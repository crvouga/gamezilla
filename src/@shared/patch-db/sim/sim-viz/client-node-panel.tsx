import { useCallback, useMemo, useState } from 'react';
import { DependencyInjectionContainer } from '../../../dependency-injection/dependency-injection-container';
import { ContainerProvider } from '../../../dependency-injection/react';
import { PatchesDbToken, useEntities } from '../../../patch-db/react';
import { SubscribablePatchesDbToken } from '../../../patch-db/subscribable';
import {
  nextShapeOrder,
  playgroundClearAllShapes,
  playgroundCreateShape,
  playgroundDeleteShape,
  playgroundRandomizeShape,
  playgroundReorderShapes,
  shapeListQuery,
} from '../playground-shapes';
import type { PlaygroundClientHandle } from '../playground-sim';
import {
  IconClear,
  IconClock,
  IconLaptop,
  IconPartition,
  IconRemove,
  IconSync,
} from './icons';
import { NodePanelShell } from './node-panel-shell';
import { ShapeList } from './shape-list';
import { useSimContext } from './sim-context';
import { btnAction, btnSmall } from './styles';
import { useAsyncAction } from './use-async-action';
import { useDragReorder } from './use-drag-reorder';
import { useClientTopoAnimation } from './use-topo-animation';

function ClientNodePanelInner({ client }: { client: PlaygroundClientHandle }) {
  const { sim, topoRef, bumpGraph, bumpLink, removeClient } = useSimContext();

  const shapeQuery = useMemo(() => shapeListQuery(), []);
  const { entities } = useEntities(shapeQuery);
  const [latencyMs, setLatencyMs] = useState(() => client.link.getLatency());
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
            className={`${btnSmall} ml-auto hover:text-red-400`}
            title="Remove client"
          >
            <IconRemove />
          </button>
        </>
      }
    >
      {/* Latency slider */}
      <div className="mb-2 flex items-center gap-2 rounded-lg border border-white/8 bg-white/4 px-2 py-1.5">
        <span className="text-white/40">
          <IconClock />
        </span>
        <input
          type="range"
          min={0}
          max={3000}
          step={50}
          value={latencyMs}
          onChange={(e) => handleLatencyChange(Number(e.target.value))}
          className="h-1 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-violet-400"
        />
        <span className="w-14 text-right font-mono text-[0.65rem] text-white/50">
          {latencyMs}ms
        </span>
      </div>

      {/* Action toolbar */}
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
              animatePush();
              await sim.syncNow(client.id);
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
              animatePush();
              await playgroundClearAllShapes(sim, client.id, entities);
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
export function ClientNodePanel({ client }: { client: PlaygroundClientHandle }) {
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
