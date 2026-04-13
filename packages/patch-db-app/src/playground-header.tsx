import { useCallback, useState } from 'react';
import { SHAPE_ENTITY_TYPE } from '@gamezilla/patch-db/sim/playground-shapes';
import { Badge, Box, Button, Divider, Select, Stack, Text } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui';
import { IconPlus } from './icons';
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
      sx={{ px: 4, py: 3, gap: 3 }}
      style={{ borderBottomWidth: 1, borderBottomColor: theme.colors.border }}
    >
      <Stack direction="horizontal" spacing={3} align="center">
        <Box style={{ flex: 1 }}>
          <Stack direction="horizontal" spacing={2} align="center" wrap>
            <Badge label={SHAPE_ENTITY_TYPE} size="sm" color={theme.colors.tintMuted} />
            <Text
              variant="mono"
              style={{
                fontSize: 11,
                color: theme.colors.textSecondary,
              }}
              label={sim.serverId}
            />
          </Stack>
        </Box>

        <Button
          title="Reset"
          variant="ghost"
          size="sm"
          color="destructive"
          onPress={reset}
        />
      </Stack>

      <Divider />

      <Stack direction="horizontal" spacing={3} align="center" wrap>
        <Box style={{ minWidth: 120 }}>
          <Select
            label="Global latency"
            options={LATENCY_BUCKETS}
            value={globalLatency}
            onValueChange={handleGlobalLatencyChange}
          />
        </Box>
        <Box style={{ flex: 1 }} />
        <Button
          title="Add Client"
          variant="solid"
          size="sm"
          startIcon={<IconPlus size={14} />}
          onPress={addClient}
        />
      </Stack>
    </Box>
  );
}
