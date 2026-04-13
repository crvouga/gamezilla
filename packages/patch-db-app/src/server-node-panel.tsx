import { useCallback } from 'react';
import {
  nextShapeOrder,
  playgroundServerCreateShape,
  playgroundServerDeleteShape,
  playgroundServerRandomizeShape,
  playgroundServerReorderShapes,
} from '@gamezilla/patch-db/sim/playground-shapes';
import { Box, Button, Divider, IconButton, Stack, Text } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui';
import { IconPartition, IconServer, IconSync, IconShuffle, IconClear } from './icons';
import { NodePanelShell } from './node-panel-shell';
import { ShapeList } from './shape-list';
import { useSimContext } from './sim-context';
import { useAsyncAction } from './use-async-action';
import { useServerShapes } from './use-server-shapes';

export function ServerNodePanel() {
  const { sim, bumpGraph, bumpLink } = useSimContext();
  const { entities, readError, refresh } = useServerShapes(sim);
  const serverPartitioned = sim.isServerPartitioned();
  const theme = useTheme();

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
      subtitle="Authority"
      partitioned={serverPartitioned}
    >
      <Stack spacing={3}>
        <Stack direction="horizontal" spacing={2} align="center">
          <Button
            title={serverPartitioned ? 'Reconnect' : 'Partition'}
            variant={serverPartitioned ? 'solid' : 'ghost'}
            size="sm"
            {...(serverPartitioned ? { color: 'destructive' } : {})}
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
          <Box style={{ flex: 1 }} />
          <IconButton
            size={32}
            background={theme.colors.surface}
            disabled={busy}
            onPress={() =>
              run(async () => {
                await sim.pollAllClients();
              })
            }
          >
            <IconSync size={16} />
          </IconButton>
          <IconButton
            size={32}
            background={theme.colors.surface}
            disabled={busy || entities.length === 0}
            onPress={() =>
              run(async () => {
                for (const e of entities) {
                  await playgroundServerRandomizeShape(sim, e.entityId);
                }
              })
            }
          >
            <IconShuffle size={16} />
          </IconButton>
          <IconButton
            size={32}
            disabled={busy}
            onPress={() =>
              run(async () => {
                await sim.wipeServerDb();
              })
            }
          >
            <IconClear size={16} />
          </IconButton>
        </Stack>

        <Divider />

        <Box>
          <Text
            variant="caption"
            style={{ color: theme.colors.textSecondary, marginBottom: 8 }}
            label={`Shapes (${entities.length})`}
          />
          <ShapeList
            entities={entities}
            busy={busy}
            note={displayNote}
            onRandomize={handleRandomize}
            onDelete={handleDelete}
            onCreate={handleCreate}
            onReorder={handleReorder}
          />
        </Box>
      </Stack>
    </NodePanelShell>
  );
}
