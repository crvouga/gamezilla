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

function ClientNodePanelInner({ client }: { client: PlaygroundClientHandle }) {
  const { sim, bumpGraph, bumpLink, removeClient } = useSimContext();
  const theme = useTheme();

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

  return (
    <NodePanelShell
      icon={<IconLaptop />}
      title={client.id}
      subtitle={`Latency: ${LATENCY_BUCKETS.find((b) => b.value === latencyMs)?.label ?? `${latencyMs} ms`}`}
      partitioned={partitioned}
      headerExtra={
        <IconButton size={28} onPress={() => removeClient(client.id)}>
          <IconRemove size={16} />
        </IconButton>
      }
    >
      <Stack spacing={3}>
        <Stack direction="horizontal" spacing={2} align="center">
          <Button
            title={partitioned ? 'Reconnect' : 'Partition'}
            variant={partitioned ? 'solid' : 'ghost'}
            size="sm"
            {...(partitioned ? { color: 'destructive' } : {})}
            disabled={busy}
            startIcon={<IconPartition active={partitioned} size={14} />}
            onPress={() =>
              run(async () => {
                if (client.link.isPartitioned()) {
                  client.link.heal();
                } else {
                  client.link.partition();
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
                await sim.syncNow(client.id);
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
                  await playgroundRandomizeShape(sim, client.id, e.entityId);
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
                await sim.wipeClientDb(client.id);
              })
            }
          >
            <IconClear size={16} />
          </IconButton>
        </Stack>

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
            busy={busy}
            note={note}
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
