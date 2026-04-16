import type { PlaygroundSim } from '@gamezilla/patch-db/sim/playground-sim';
import { Box, ScrollView, Stack, Text } from '@gamezilla/shared/ui';
import { useTheme } from '@gamezilla/shared/ui/theme';
import { useMemo } from 'react';
import { ClientNodePanel } from './client-node-panel';
import { IconLaptop, IconServer } from './icons';
import { ServerNodePanel } from './server-node-panel';

function ConnectionLine({ partitioned }: { partitioned: boolean }) {
  const theme = useTheme();
  return (
    <Box sx={{ alignItems: 'center', py: 1 }}>
      <Box
        style={{
          width: 2,
          height: 32,
          backgroundColor: partitioned
            ? theme.colors.destructive + '44'
            : theme.colors.border,
        }}
      />
      {partitioned && (
        <Box
          style={{
            position: 'absolute',
            top: 10,
            width: 12,
            height: 12,
            borderRadius: 6,
            backgroundColor: theme.colors.destructive,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{ color: '#fff', fontSize: 8, fontWeight: 'bold' }}
            label="✕"
          />
        </Box>
      )}
    </Box>
  );
}

function SectionLabel({
  icon,
  label,
  count,
}: {
  icon: React.ReactNode;
  label: string;
  count?: number;
}) {
  const theme = useTheme();
  return (
    <Stack direction="horizontal" spacing={2} align="center" sx={{ pb: 2 }}>
      <Box style={{ opacity: 0.5 }}>{icon}</Box>
      <Text
        variant="caption"
        style={{ color: theme.colors.textSecondary, letterSpacing: 1 }}
        label={label.toUpperCase()}
      />
      {count !== undefined && (
        <Text
          variant="caption"
          style={{ color: theme.colors.textSecondary, opacity: 0.6 }}
          label={`(${count})`}
        />
      )}
    </Stack>
  );
}

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
  const clients = useMemo(() => [...sim.clients], [sim, pulseKey]);

  return (
    <ScrollView sx={{ flex: 1 }}>
      <Box sx={{ p: 4, pb: 8, gap: 6 }}>
        <Box>
          <SectionLabel icon={<IconServer size={14} />} label="Server" />
          <Box style={{ maxWidth: 480 }}>
            <ServerNodePanel />
          </Box>
        </Box>

        {clients.length > 0 && (
          <Box>
            <SectionLabel
              icon={<IconLaptop size={14} />}
              label="Clients"
              count={clients.length}
            />
            <Stack spacing={3}>
              {clients.map((c) => {
                const partitioned =
                  c.link.isPartitioned() || sim.isServerPartitioned();
                return (
                  <Box key={c.id}>
                    <ConnectionLine partitioned={partitioned} />
                    <Box style={{ maxWidth: 480 }}>
                      <ClientNodePanel client={c} />
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          </Box>
        )}
      </Box>
    </ScrollView>
  );
}
