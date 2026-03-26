import { useCallback } from 'react';
import {
  nextShapeOrder,
  playgroundServerClearAllShapes,
  playgroundServerCreateShape,
  playgroundServerDeleteShape,
  playgroundServerRandomizeShape,
  playgroundServerReorderShapes,
} from '../playground-shapes';
import { IconClear, IconServer } from './icons';
import { NodePanelShell } from './node-panel-shell';
import { ShapeList } from './shape-list';
import { useSimContext } from './sim-context';
import { btnSmall } from './styles';
import { useAsyncAction } from './use-async-action';
import { useDragReorder } from './use-drag-reorder';
import { useServerShapes } from './use-server-shapes';
import { useServerTopoAnimation } from './use-topo-animation';

export function ServerNodePanel() {
  const { sim, topoRef, bumpGraph } = useSimContext();
  const { entities, readError, refresh } = useServerShapes(sim);
  const animatePollAll = useServerTopoAnimation(sim, topoRef);

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
      iconColor="text-violet-400"
      title={sim.serverId}
      headerExtra={
        <span className="ml-auto text-[0.65rem] text-white/35">authority</span>
      }
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[0.7rem] text-white/45">
          {entities.length} shape(s)
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            run(async () => {
              animatePollAll();
              await playgroundServerClearAllShapes(sim, entities);
            })
          }
          className={`${btnSmall} ml-auto`}
          title="Clear all shapes"
        >
          <IconClear />
        </button>
      </div>

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
