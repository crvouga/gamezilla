import { Box, Button, Divider, IconButton, Stack, Text } from '@pkgs/ui';
import { useTheme } from '@pkgs/ui/theme';
import type { Entity } from '@pkgs/patch-db/interface';
import {
  nextShapeOrder,
  playgroundServerCreateShape,
  playgroundServerDeleteShape,
  playgroundServerRandomizeShape,
  playgroundServerReorderShapes,
} from '@pkgs/patch-db/sim/playground-shapes';
import type { PlaygroundSim } from '@pkgs/patch-db/sim/playground-sim';
import { useLingui } from '@lingui/react/macro';
import { useCallback } from 'react';
import {
  IconClear,
  IconPartition,
  IconServer,
  IconShuffle,
  IconSync,
} from './icons';
import { NodePanelShell } from './node-panel-shell';
import { ShapeList } from './shape-list';
import { useSimContext } from './sim-context';
import { useAsyncAction } from './use-async-action';
import { useServerShapes } from './use-server-shapes';

function useServerShapeActions(
  sim: PlaygroundSim,
  entities: Entity[],
  run: ReturnType<typeof useAsyncAction>['run']
) {
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
  const randomizeAll = useCallback(
    () =>
      run(async () => {
        for (const e of entities) {
          await playgroundServerRandomizeShape(sim, e.entityId);
        }
      }),
    [run, sim, entities]
  );
  return {
    handleRandomize,
    handleDelete,
    handleCreate,
    handleReorder,
    randomizeAll,
  };
}

function useServerLinkActions(
  sim: PlaygroundSim,
  run: ReturnType<typeof useAsyncAction>['run']
) {
  const { bumpLink } = useSimContext();
  const togglePartition = useCallback(
    () =>
      run(async () => {
        if (sim.isServerPartitioned()) {
          sim.healServer();
        } else {
          sim.partitionServer();
        }
        bumpLink();
      }),
    [run, sim, bumpLink]
  );
  const pollAll = useCallback(
    () =>
      run(async () => {
        await sim.pollAllClients();
      }),
    [run, sim]
  );
  const wipeServer = useCallback(
    () =>
      run(async () => {
        await sim.wipeServerDb();
      }),
    [run, sim]
  );
  return { togglePartition, pollAll, wipeServer };
}

function useServerActions(
  sim: PlaygroundSim,
  entities: Entity[],
  refresh: () => void
) {
  const { bumpGraph } = useSimContext();
  const onSuccess = useCallback(() => {
    refresh();
    bumpGraph();
  }, [refresh, bumpGraph]);
  const action = useAsyncAction(onSuccess);
  const shapeActions = useServerShapeActions(sim, entities, action.run);
  const linkActions = useServerLinkActions(sim, action.run);
  return { ...action, ...shapeActions, ...linkActions };
}

function ServerControlBar({
  busy,
  partitioned,
  hasEntities,
  togglePartition,
  pollAll,
  randomizeAll,
  wipeServer,
}: {
  busy: boolean;
  partitioned: boolean;
  hasEntities: boolean;
  togglePartition: () => void;
  pollAll: () => void;
  randomizeAll: () => void;
  wipeServer: () => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Stack direction="horizontal" spacing={2} align="center">
      <Button
        title={partitioned ? t`Reconnect` : t`Partition`}
        intent={partitioned ? 'danger' : 'neutral'}
        size="sm"
        disabled={busy}
        startIcon={<IconPartition active={partitioned} size={14} />}
        onPress={togglePartition}
      />
      <Box style={{ flex: 1 }} />
      <IconButton
        size={32}
        background={theme.colors.surface}
        disabled={busy}
        onPress={pollAll}
      >
        <IconSync size={16} />
      </IconButton>
      <IconButton
        size={32}
        background={theme.colors.surface}
        disabled={busy || !hasEntities}
        onPress={randomizeAll}
      >
        <IconShuffle size={16} />
      </IconButton>
      <IconButton size={32} disabled={busy} onPress={wipeServer}>
        <IconClear size={16} />
      </IconButton>
    </Stack>
  );
}

export function ServerNodePanel() {
  const { t } = useLingui();
  const { sim } = useSimContext();
  const { entities, readError, refresh } = useServerShapes(sim);
  const serverPartitioned = sim.isServerPartitioned();
  const theme = useTheme();
  const actions = useServerActions(sim, entities, refresh);
  const displayNote = readError ?? actions.note;
  const entityCount = entities.length;

  return (
    <NodePanelShell
      icon={<IconServer />}
      title={sim.serverId}
      subtitle={t`Authority`}
      partitioned={serverPartitioned}
    >
      <Stack spacing={3}>
        <ServerControlBar
          busy={actions.busy}
          partitioned={serverPartitioned}
          hasEntities={entities.length > 0}
          togglePartition={actions.togglePartition}
          pollAll={actions.pollAll}
          randomizeAll={actions.randomizeAll}
          wipeServer={actions.wipeServer}
        />

        <Divider />

        <Box>
          <Text
            variant="caption"
            style={{ color: theme.colors.textSecondary, marginBottom: 8 }}
            label={t`Shapes (${entityCount})`}
          />
          <ShapeList
            entities={entities}
            busy={actions.busy}
            note={displayNote}
            onRandomize={actions.handleRandomize}
            onDelete={actions.handleDelete}
            onCreate={actions.handleCreate}
            onReorder={actions.handleReorder}
          />
        </Box>
      </Stack>
    </NodePanelShell>
  );
}
