import {
  Badge,
  Box,
  Button,
  Divider,
  Select,
  Stack,
  Text,
  useTheme,
} from '@gamezilla/lib/ui';
import { SHAPE_ENTITY_TYPE } from '@gamezilla/patch-db/sim/playground-shapes';
import { useLingui } from '@lingui/react/macro';
import { useCallback, useMemo, useState } from 'react';

import { IconPlus } from './icons';
import { useSimContext } from './sim-context';

function HeaderTopRow({
  serverId,
  reset,
}: {
  serverId: string;
  reset: () => void;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  return (
    <Stack direction="horizontal" spacing={3} align="center">
      <Box style={{ flex: 1 }}>
        <Stack direction="horizontal" spacing={2} align="center" wrap>
          <Badge
            label={SHAPE_ENTITY_TYPE}
            size="sm"
            color={theme.colors.tintMuted}
          />
          <Text
            variant="mono"
            style={{ fontSize: 11, color: theme.colors.textSecondary }}
            label={serverId}
          />
        </Stack>
      </Box>
      <Button
        title={t`Reset`}
        variant="ghost"
        size="sm"
        color="destructive"
        onPress={reset}
      />
    </Stack>
  );
}

function HeaderControls({
  globalLatency,
  onLatencyChange,
  onAddClient,
}: {
  globalLatency: number;
  onLatencyChange: (ms: number) => void;
  onAddClient: () => void;
}) {
  const { t } = useLingui();
  const latencyBuckets = useMemo(
    () => [
      { value: 0, label: t`0 ms` },
      { value: 50, label: t`50 ms` },
      { value: 150, label: t`150 ms` },
      { value: 500, label: t`500 ms` },
      { value: 1000, label: t`1 s` },
      { value: 2000, label: t`2 s` },
      { value: 5000, label: t`5 s` },
    ],
    [t]
  );
  return (
    <Stack direction="horizontal" spacing={3} align="center" wrap>
      <Box style={{ minWidth: 120 }}>
        <Select
          label={t`Global latency`}
          options={latencyBuckets}
          value={globalLatency}
          onValueChange={onLatencyChange}
        />
      </Box>
      <Box style={{ flex: 1 }} />
      <Button
        title={t`Add Client`}
        variant="solid"
        size="sm"
        startIcon={<IconPlus size={14} />}
        onPress={onAddClient}
      />
    </Stack>
  );
}

export function PlaygroundHeader() {
  const { sim, addClient, reset } = useSimContext();
  const [globalLatency, setGlobalLatency] = useState(() =>
    sim.getGlobalLatency()
  );

  const handleGlobalLatencyChange = useCallback(
    (ms: number) => {
      setGlobalLatency(ms);
      sim.setGlobalLatency(ms);
    },
    [sim]
  );

  return (
    <Box sx={{ px: 4, py: 3, gap: 3 }}>
      <HeaderTopRow serverId={sim.serverId} reset={reset} />
      <Divider />
      <HeaderControls
        globalLatency={globalLatency}
        onLatencyChange={handleGlobalLatencyChange}
        onAddClient={addClient}
      />
    </Box>
  );
}
