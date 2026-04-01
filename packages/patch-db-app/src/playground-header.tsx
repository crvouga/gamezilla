import { useCallback, useState } from 'react';
import { SHAPE_ENTITY_TYPE } from '@gamezilla/patch-db/sim/playground-shapes';
import { Box, Button, Select, Stack, Text } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui';
import { useSimContext } from './sim-context';

const LATENCY_BUCKETS = [
  { value: 0, label: '0 ms' },
  { value: 50, label: '50 ms' },
  { value: 150, label: '150 ms' },
  { value: 500, label: '500 ms' },
  { value: 1000, label: '1 s' },
  { value: 2000, label: '2 s' },
  { value: 5000, label: '5 s' },
];

export function PlaygroundHeader() {
  const { sim, addClient, reset } = useSimContext();
  const [globalLatency, setGlobalLatency] = useState(() =>
    sim.getGlobalLatency()
  );
  const theme = useTheme();

  const handleGlobalLatencyChange = useCallback(
    (ms: number) => {
      setGlobalLatency(ms);
      sim.setGlobalLatency(ms);
    },
    [sim]
  );

  return (
    <Box
      sx={{ px: 3, py: 2, gap: 2 }}
      style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
    >
      <Stack direction="horizontal" spacing={2} align="center">
        <Text variant="subtitle" style={{ flex: 1 }}>
          Patch DB Playground
        </Text>
      </Stack>
      <Text variant="mono" sx={{ mb: 1 }}>
        {SHAPE_ENTITY_TYPE} / {sim.serverId}
      </Text>
      <Stack direction="horizontal" spacing={2} wrap>
        <Box style={{ minWidth: 120 }}>
          <Select
            label="Latency"
            options={LATENCY_BUCKETS}
            value={globalLatency}
            onValueChange={handleGlobalLatencyChange}
          />
        </Box>
        <Button title="Reset" variant="outlined" size="sm" onPress={reset} />
        <Button
          title="Add Client"
          variant="solid"
          size="sm"
          onPress={addClient}
        />
      </Stack>
    </Box>
  );
}
