import { useCallback } from 'react';
import {
  nextShapeOrder,
  playgroundServerCreateShape,
  playgroundServerDeleteShape,
  playgroundServerRandomizeShape,
  playgroundServerReorderShapes,
} from '../patch-db/sim/playground-shapes';
import { IconPartition, IconServer, IconSync } from './icons';
import { NodePanelShell } from './node-panel-shell';
import { ShapeList } from './shape-list';
import { useSimContext } from './sim-context';
import { btnAction } from './styles';
import { useAsyncAction } from './use-async-action';
import { useDragReorder } from './use-drag-reorder';
import { useServerShapes } from './use-server-shapes';
import { useServerTopoAnimation } from './use-topo-animation';

export function ServerNodePanel() {
  const { sim, topoRef, bumpGraph, bumpLink } = useSimContext();
  const { entities, readError, refresh } = useServerShapes(sim);
  const animatePollAll = useServerTopoAnimation(sim, topoRef);
  const serverPartitioned = sim.isServerPartitioned();

  const onSuccess = useCallback(() => {
    refresh();
    bumpGraph();
  }, [refresh, bumpGraph]);

  const { busy, note, run } = useAsyncAction(onSuccess);

  const handleRandomize = useCallback(
    (entityId: string) =>
      run(async () => {
        animatePollAll();
        await playgroundServerRandomizeShape(sim, entityId);
      }),
    [run, sim, animatePollAll]
  );

  const handleDelete = useCallback(
    (entityId: string) =>
      run(async () => {
        animatePollAll();
        await playgroundServerDeleteShape(sim, entityId);
      }),
    [run, sim, animatePollAll]
  );

  const handleCreate = useCallback(
    () =>
      run(async () => {
        animatePollAll();
        await playgroundServerCreateShape(sim, nextShapeOrder(entities));
      }),
    [run, sim, entities, animatePollAll]
  );

  const handleReorder = useCallback(
    (entityIds: string[]) => {
      void run(async () => {
        animatePollAll();
        await playgroundServerReorderShapes(sim, entityIds);
      });
    },
    [run, sim, animatePollAll]
  );

  const { handleDragStart, handleDragOver, handleDrop } = useDragReorder(
    entities,
    handleReorder
  );

  const displayNote = readError ?? note;

  return (
    <NodePanelShell
      icon={<IconServer />}
      iconColor={serverPartitioned ? 'text-red-400' : 'text-violet-400'}
      title={sim.serverId}
      partitioned={serverPartitioned}
      headerExtra={
        <>
          {serverPartitioned && (
            <span className="rounded bg-red-950/80 px-1.5 py-0.5 text-[0.55rem] font-bold uppercase text-red-400">
              offline
            </span>
          )}
          <span className="ml-auto text-[0.65rem] text-white/35">
            authority
          </span>
        </>
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              if (sim.isServerPartitioned()) {
                sim.healServer();
              } else {
                sim.partitionServer();
              }
              bumpLink();
            })
          }
          className={`${btnAction} ${
            serverPartitioned
              ? 'border-red-400/50 bg-red-950/40 text-red-200'
              : ''
          }`}
        >
          <IconPartition active={serverPartitioned} size={14} />
          {serverPartitioned ? 'Reconnect' : 'Partition'}
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await sim.pollAllClients();
            })
          }
          className={btnAction}
        >
          <IconSync size={14} />
          Sync All
        </button>

        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              await sim.wipeServerDb();
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
              animatePollAll();
              for (const e of entities) {
                await playgroundServerRandomizeShape(sim, e.entityId);
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
        note={displayNote}
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
