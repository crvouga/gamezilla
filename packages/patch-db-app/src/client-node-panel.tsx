import { useCallback, useMemo, useState } from 'react';
import { DependencyInjectionContainer } from '@gamezilla/shared/dependency-injection/dependency-injection-container';
import { ContainerProvider } from '@gamezilla/shared/dependency-injection/react';
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
import { Badge, Box, Button, Select, Stack } from '@gamezilla/shared/ui';
import { IconLaptop, IconPartition, IconSync } from './icons';
import { NodePanelShell } from './node-panel-shell';
import { ShapeList } from './shape-list';
import { useSimContext } from './sim-context';
import { useAsyncAction } from './use-async-action';

const LATENCY_BUCKETS = [
  { value: 0, label: '0ms' },
  { value: 50, label: '50ms' },
  { value: 150, label: '150ms' },
  { value: 500, label: '500ms' },
  { value: 1000, label: '1s' },
  { value: 2000, label: '2s' },
  { value: 5000, label: '5s' },
];

function ClientNodePanelInner({ client }: { client: PlaygroundClientHandle }) {
  const { sim, bumpGraph, bumpLink, removeClient } = useSimContext();

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
      partitioned={partitioned}
      headerExtra={
        <Stack direction="horizontal" spacing={1} align="center">
          {partitioned && (
            <Badge label="OFFLINE" color="destructive" size="sm" />
          )}
          <Button
            title="Remove"
            variant="text"
            size="sm"
            color="destructive"
            onPress={() => removeClient(client.id)}
          />
        </Stack>
      }
    >
      <Stack spacing={2}>
        <Stack direction="horizontal" spacing={1} wrap>
          <Button
            title={partitioned ? 'Reconnect' : 'Partition'}
            variant="outlined"
            size="sm"
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
          <Button
            title="Sync"
            variant="outlined"
            size="sm"
            disabled={busy}
            startIcon={<IconSync size={14} />}
            onPress={() =>
              run(async () => {
                await sim.syncNow(client.id);
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
                await sim.wipeClientDb(client.id);
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
                  await playgroundRandomizeShape(sim, client.id, e.entityId);
                }
              })
            }
          />
        </Stack>

        <Box style={{ maxWidth: 160 }}>
          <Select
            options={LATENCY_BUCKETS}
            value={latencyMs}
            onValueChange={handleLatencyChange}
          />
        </Box>

        <ShapeList
          entities={entities}
          busy={busy}
          note={note}
          onRandomize={handleRandomize}
          onDelete={handleDelete}
          onCreate={handleCreate}
          onReorder={handleReorder}
        />
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
