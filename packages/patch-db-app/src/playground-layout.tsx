import { useMemo } from 'react';
import type { PlaygroundSim } from '@gamezilla/patch-db/sim/playground-sim';
import { Box, ScrollView, Stack } from '@gamezilla/shared/ui';
import { ClientNodePanel } from './client-node-panel';
import { ServerNodePanel } from './server-node-panel';

export function PlaygroundLayout({
  sim,
  pulseKey,
  linkEpoch,
}: {
  sim: PlaygroundSim;
  pulseKey: number;
  linkEpoch: number;
}) {
  void linkEpoch;
  const clients = useMemo(
    () => [...sim.clients],
    [sim, pulseKey]
  );

  return (
    <ScrollView sx={{ flex: 1, p: 4 }}>
      <Box sx={{ alignItems: 'center', gap: 4, pb: 8 }}>
        <Box style={{ width: 300 }}>
          <ServerNodePanel />
        </Box>

        {clients.length > 0 && (
          <Stack
            direction="horizontal"
            spacing={3}
            wrap
            justify="center"
          >
            {clients.map((c) => (
              <Box key={c.id} style={{ width: 300 }}>
                <ClientNodePanel client={c} />
              </Box>
            ))}
          </Stack>
        )}
      </Box>
    </ScrollView>
  );
}
