import { useCallback } from 'react';
import {
  nextShapeOrder,
  playgroundServerCreateShape,
  playgroundServerDeleteShape,
  playgroundServerRandomizeShape,
  playgroundServerReorderShapes,
} from '@gamezilla/patch-db/sim/playground-shapes';
import { Badge, Button, Stack, Text } from '@gamezilla/shared/ui';
import { IconPartition, IconServer, IconSync } from './icons';
import { NodePanelShell } from './node-panel-shell';
import { ShapeList } from './shape-list';
import { useSimContext } from './sim-context';
import { useAsyncAction } from './use-async-action';
import { useServerShapes } from './use-server-shapes';

export function ServerNodePanel() {
  const { sim, bumpGraph, bumpLink } = useSimContext();
  const { entities, readError, refresh } = useServerShapes(sim);
  const serverPartitioned = sim.isServerPartitioned();

  const onSuccess = useCallback(() => {
    refresh();
    bumpGraph();
  }, [refresh, bumpGraph]);

  const { busy, note, run } = useAsyncAction(onSuccess);

  const handleRandomize = useCallback(
    (entityId: string) =>
      run(async () => {
        await playgroundServerRandomizeShape(sim, entityId);
      }),
    [run, sim]
  );

  const handleDelete = useCallback(
    (entityId: string) =>
      run(async () => {
        await playgroundServerDeleteShape(sim, entityId);
      }),
    [run, sim]
  );

  const handleCreate = useCallback(
    () =>
      run(async () => {
        await playgroundServerCreateShape(sim, nextShapeOrder(entities));
      }),
    [run, sim, entities]
  );

  const handleReorder = useCallback(
    (entityIds: string[]) => {
      void run(async () => {
        await playgroundServerReorderShapes(sim, entityIds);
      });
    },
    [run, sim]
  );

  const displayNote = readError ?? note;

  return (
    <NodePanelShell
      icon={<IconServer />}
      title={sim.serverId}
      partitioned={serverPartitioned}
      headerExtra={
        <Stack direction="horizontal" spacing={1} align="center">
          {serverPartitioned && (
            <Badge label="OFFLINE" color="destructive" size="sm" />
          )}
          <Text variant="caption">authority</Text>
        </Stack>
      }
    >
      <Stack spacing={2}>
        <Stack direction="horizontal" spacing={1} wrap>
          <Button
            title={serverPartitioned ? 'Reconnect' : 'Partition'}
            variant="outlined"
            size="sm"
            disabled={busy}
            startIcon={<IconPartition active={serverPartitioned} size={14} />}
            onPress={() =>
              run(async () => {
                if (sim.isServerPartitioned()) {
                  sim.healServer();
                } else {
                  sim.partitionServer();
                }
                bumpLink();
              })
            }
          />
          <Button
            title="Sync All"
            variant="outlined"
            size="sm"
            disabled={busy}
            startIcon={<IconSync size={14} />}
            onPress={() =>
              run(async () => {
                await sim.pollAllClients();
              })
            }
          />
          <Button
            title="Wipe"
            variant="outlined"
            size="sm"
            color="destructive"
            disabled={busy}
            onPress={() =>
              run(async () => {
                await sim.wipeServerDb();
              })
            }
          />
          <Button
            title="Shuffle"
            variant="outlined"
            size="sm"
            disabled={busy || entities.length === 0}
            onPress={() =>
              run(async () => {
                for (const e of entities) {
                  await playgroundServerRandomizeShape(sim, e.entityId);
                }
              })
            }
          />
        </Stack>

        <Text variant="caption">
          {entities.length} shape(s)
        </Text>

        <ShapeList
          entities={entities}
          busy={busy}
          note={displayNote}
          onRandomize={handleRandomize}
          onDelete={handleDelete}
          onCreate={handleCreate}
          onReorder={handleReorder}
        />
      </Stack>
    </NodePanelShell>
  );
}
