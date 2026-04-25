import type { Entity } from '@gamezilla/patch-db/interface';
import { PatchesDbToken, useEntities } from '@gamezilla/patch-db/react';
import {
  nextShapeOrder,
  playgroundCreateShape,
  playgroundDeleteShape,
  playgroundRandomizeShape,
  playgroundReorderShapes,
  shapeListQuery,
} from '@gamezilla/patch-db/sim/playground-shapes';
import type { PlaygroundClientHandle } from '@gamezilla/patch-db/sim/playground-sim';
import { SubscribablePatchesDbToken } from '@gamezilla/patch-db/subscribable';
import { DependencyInjectionContainer } from '@gamezilla/lib/dependency-injection/dependency-injection-container';
import { ContainerProvider } from '@gamezilla/lib/dependency-injection/react';
import {
  Box,
  Button,
  Divider,
  IconButton,
  Select,
  Stack,
  Text,
} from '@gamezilla/lib/ui';
import { useTheme } from '@gamezilla/lib/ui/theme';
import { useCallback, useMemo, useState } from 'react';
import {
  IconClear,
  IconLaptop,
  IconPartition,
  IconRemove,
  IconShuffle,
  IconSync,
} from './icons';
import { NodePanelShell } from './node-panel-shell';
import { ShapeList } from './shape-list';
import { useSimContext } from './sim-context';
import { useAsyncAction } from './use-async-action';

const LATENCY_BUCKETS = [
  { value: 0, label: '0 ms' },
  { value: 50, label: '50 ms' },
  { value: 150, label: '150 ms' },
  { value: 500, label: '500 ms' },
  { value: 1000, label: '1 s' },
  { value: 2000, label: '2 s' },
  { value: 5000, label: '5 s' },
];

function closestLatency(raw: number) {
  return LATENCY_BUCKETS.reduce((prev, cur) =>
    Math.abs(cur.value - raw) < Math.abs(prev.value - raw) ? cur : prev
  ).value;
}

function useClientShapeActions(
  client: PlaygroundClientHandle,
  entities: Entity[],
  run: ReturnType<typeof useAsyncAction>['run'],
) {
  const { sim } = useSimContext();
  const handleRandomize = useCallback(
    (entityId: string) =>
      run(async () => {
        await playgroundRandomizeShape(sim, client.id, entityId);
      }),
    [run, sim, client.id],
  );
  const handleDelete = useCallback(
    (entityId: string) =>
      run(async () => {
        await playgroundDeleteShape(sim, client.id, entityId);
      }),
    [run, sim, client.id],
  );
  const handleCreate = useCallback(
    () =>
      run(async () => {
        await playgroundCreateShape(sim, client.id, nextShapeOrder(entities));
      }),
    [run, sim, client.id, entities],
  );
  const handleReorder = useCallback(
    (entityIds: string[]) => {
      void run(async () => {
        await playgroundReorderShapes(sim, client.id, entityIds);
      });
    },
    [run, sim, client.id],
  );
  const randomizeAll = useCallback(
    () =>
      run(async () => {
        for (const e of entities) {
          await playgroundRandomizeShape(sim, client.id, e.entityId);
        }
      }),
    [run, sim, client.id, entities],
  );
  return {
    handleRandomize,
    handleDelete,
    handleCreate,
    handleReorder,
    randomizeAll,
  };
}

function useClientLinkActions(
  client: PlaygroundClientHandle,
  run: ReturnType<typeof useAsyncAction>['run'],
) {
  const { sim, bumpLink } = useSimContext();
  const togglePartition = useCallback(
    () =>
      run(async () => {
        if (client.link.isPartitioned()) {
          client.link.heal();
        } else {
          client.link.partition();
        }
        bumpLink();
      }),
    [run, client.link, bumpLink],
  );
  const syncNow = useCallback(
    () =>
      run(async () => {
        await sim.syncNow(client.id);
      }),
    [run, sim, client.id],
  );
  const wipeClientDb = useCallback(
    () =>
      run(async () => {
        await sim.wipeClientDb(client.id);
      }),
    [run, sim, client.id],
  );
  return { togglePartition, syncNow, wipeClientDb };
}

function useClientActions(
  client: PlaygroundClientHandle,
  entities: Entity[],
) {
  const { bumpGraph } = useSimContext();
  const action = useAsyncAction(bumpGraph);
  const shapeActions = useClientShapeActions(client, entities, action.run);
  const linkActions = useClientLinkActions(client, action.run);
  return { ...action, ...shapeActions, ...linkActions };
}

function ClientControlBar({
  busy,
  partitioned,
  hasEntities,
  togglePartition,
  syncNow,
  randomizeAll,
  wipeClientDb,
}: {
  busy: boolean;
  partitioned: boolean;
  hasEntities: boolean;
  togglePartition: () => void;
  syncNow: () => void;
  randomizeAll: () => void;
  wipeClientDb: () => void;
}) {
  const theme = useTheme();
  return (
    <Stack direction="horizontal" spacing={2} align="center">
      <Button
        title={partitioned ? 'Reconnect' : 'Partition'}
        variant={partitioned ? 'solid' : 'ghost'}
        size="sm"
        {...(partitioned ? { color: 'destructive' } : {})}
        disabled={busy}
        startIcon={<IconPartition active={partitioned} size={14} />}
        onPress={togglePartition}
      />
      <Box style={{ flex: 1 }} />
      <IconButton
        size={32}
        background={theme.colors.surface}
        disabled={busy}
        onPress={syncNow}
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
      <IconButton size={32} disabled={busy} onPress={wipeClientDb}>
        <IconClear size={16} />
      </IconButton>
    </Stack>
  );
}

function ClientNodePanelInner({ client }: { client: PlaygroundClientHandle }) {
  const theme = useTheme();
  const { removeClient } = useSimContext();
  const shapeQuery = useMemo(() => shapeListQuery(), []);
  const { entities } = useEntities(shapeQuery);
  const [latencyMs, setLatencyMs] = useState(() =>
    closestLatency(client.link.getLatency()),
  );
  const partitioned = client.link.isPartitioned();
  const actions = useClientActions(client, entities);

  const handleLatencyChange = useCallback(
    (ms: number) => {
      setLatencyMs(ms);
      client.link.setLatency(ms);
    },
    [client.link],
  );

  const subtitle = `Latency: ${LATENCY_BUCKETS.find((b) => b.value === latencyMs)?.label ?? `${latencyMs} ms`}`;

  return (
    <NodePanelShell
      icon={<IconLaptop />}
      title={client.id}
      subtitle={subtitle}
      partitioned={partitioned}
      headerExtra={
        <IconButton size={28} onPress={() => removeClient(client.id)}>
          <IconRemove size={16} />
        </IconButton>
      }
    >
      <Stack spacing={3}>
        <ClientControlBar
          busy={actions.busy}
          partitioned={partitioned}
          hasEntities={entities.length > 0}
          togglePartition={actions.togglePartition}
          syncNow={actions.syncNow}
          randomizeAll={actions.randomizeAll}
          wipeClientDb={actions.wipeClientDb}
        />

        <Box style={{ maxWidth: 160 }}>
          <Select
            label="Latency"
            options={LATENCY_BUCKETS}
            value={latencyMs}
            onValueChange={handleLatencyChange}
          />
        </Box>

        <Divider />

        <Box>
          <Text
            variant="caption"
            style={{ color: theme.colors.textSecondary, marginBottom: 8 }}
            label={`Shapes (${entities.length})`}
          />
          <ShapeList
            entities={entities}
            busy={actions.busy}
            note={actions.note}
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
