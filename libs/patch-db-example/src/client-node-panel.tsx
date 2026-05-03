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
import type { Entity } from '@gamezilla/patch-db/interface';
import { PatchDbToken, useEntities } from '@gamezilla/patch-db/react';
import {
  nextShapeOrder,
  playgroundCreateShape,
  playgroundDeleteShape,
  playgroundRandomizeShape,
  playgroundReorderShapes,
  shapeListQuery,
} from '@gamezilla/patch-db/sim/playground-shapes';
import type { PlaygroundClientHandle } from '@gamezilla/patch-db/sim/playground-sim';
import { SubscribablePatchDbToken } from '@gamezilla/patch-db/subscribable';
import { useLingui } from '@lingui/react/macro';
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

type LinguiT = ReturnType<typeof useLingui>['t'];

function buildLatencyBuckets(t: LinguiT) {
  return [
    { value: 0, label: t`0 ms` },
    { value: 50, label: t`50 ms` },
    { value: 150, label: t`150 ms` },
    { value: 500, label: t`500 ms` },
    { value: 1000, label: t`1 s` },
    { value: 2000, label: t`2 s` },
    { value: 5000, label: t`5 s` },
  ];
}

const LATENCY_BUCKET_VALUES: number[] = [0, 50, 150, 500, 1000, 2000, 5000];

function closestLatency(raw: number): number {
  return LATENCY_BUCKET_VALUES.reduce<number>(
    (prev, cur) => (Math.abs(cur - raw) < Math.abs(prev - raw) ? cur : prev),
    LATENCY_BUCKET_VALUES[0] ?? 0
  );
}

function useClientShapeActions(
  client: PlaygroundClientHandle,
  entities: Entity[],
  run: ReturnType<typeof useAsyncAction>['run']
) {
  const { sim } = useSimContext();
  const handleRandomize = useCallback(
    (entityId: string) =>
      run(async () => {
        await playgroundRandomizeShape(sim, client.id, entityId);
      }),
    [run, sim, client.id]
  );
  const handleDelete = useCallback(
    (entityId: string) =>
      run(async () => {
        await playgroundDeleteShape(sim, client.id, entityId);
      }),
    [run, sim, client.id]
  );
  const handleCreate = useCallback(
    () =>
      run(async () => {
        await playgroundCreateShape(sim, client.id, nextShapeOrder(entities));
      }),
    [run, sim, client.id, entities]
  );
  const handleReorder = useCallback(
    (entityIds: string[]) => {
      void run(async () => {
        await playgroundReorderShapes(sim, client.id, entityIds);
      });
    },
    [run, sim, client.id]
  );
  const randomizeAll = useCallback(
    () =>
      run(async () => {
        for (const e of entities) {
          await playgroundRandomizeShape(sim, client.id, e.entityId);
        }
      }),
    [run, sim, client.id, entities]
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
  run: ReturnType<typeof useAsyncAction>['run']
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
    [run, client.link, bumpLink]
  );
  const syncNow = useCallback(
    () =>
      run(async () => {
        await sim.syncNow(client.id);
      }),
    [run, sim, client.id]
  );
  const wipeClientDb = useCallback(
    () =>
      run(async () => {
        await sim.wipeClientDb(client.id);
      }),
    [run, sim, client.id]
  );
  return { togglePartition, syncNow, wipeClientDb };
}

function useClientActions(client: PlaygroundClientHandle, entities: Entity[]) {
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
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Stack direction="horizontal" spacing={2} align="center">
      <Button
        title={partitioned ? t`Reconnect` : t`Partition`}
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

function ShapesSection({
  entities,
  actions,
}: {
  entities: Entity[];
  actions: ReturnType<typeof useClientActions>;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  const entityCount = entities.length;
  return (
    <Box>
      <Text
        variant="caption"
        style={{ color: theme.colors.textSecondary, marginBottom: 8 }}
        label={t`Shapes (${entityCount})`}
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
  );
}

function ClientNodePanelInner({ client }: { client: PlaygroundClientHandle }) {
  const { t } = useLingui();
  const { removeClient } = useSimContext();
  const shapeQuery = useMemo(() => shapeListQuery(), []);
  const { entities } = useEntities(shapeQuery);
  const [latencyMs, setLatencyMs] = useState(() =>
    closestLatency(client.link.getLatency())
  );
  const partitioned = client.link.isPartitioned();
  const actions = useClientActions(client, entities);
  const latencyBuckets = useMemo(() => buildLatencyBuckets(t), [t]);

  const handleLatencyChange = useCallback(
    (ms: number) => {
      setLatencyMs(ms);
      client.link.setLatency(ms);
    },
    [client.link]
  );

  const latencyLabel =
    latencyBuckets.find((b) => b.value === latencyMs)?.label ??
    t`${latencyMs} ms`;
  const subtitle = t`Latency: ${latencyLabel}`;

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
            label={t`Latency`}
            options={latencyBuckets}
            value={latencyMs}
            onValueChange={handleLatencyChange}
          />
        </Box>

        <Divider />

        <ShapesSection entities={entities} actions={actions} />
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
    c.registerValue(PatchDbToken, client.syncDb);
    c.registerValue(SubscribablePatchDbToken, client.syncDb);
    return c;
  }, [client.syncDb]);

  return (
    <ContainerProvider container={container}>
      <ClientNodePanelInner client={client} />
    </ContainerProvider>
  );
}
