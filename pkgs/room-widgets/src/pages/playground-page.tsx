import {
  Box,
  Button,
  Card,
  Divider,
  ScrollView,
  Stack,
  StatusDot,
  Text,
  useTheme,
} from '@pkgs/ui';
import { useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

import {
  Increment,
  readSimCount,
  useRoomSim,
  type SimClient,
} from './use-room-sim';

function SimPanel(props: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  const theme = useTheme();
  return (
    <Card elevation={2}>
      <Box sx={{ px: 4, py: 3 }}>
        <Stack direction="horizontal" spacing={2} align="center">
          <Text variant="bodyBold" label={props.title} />
          <StatusDot status="online" size={8} />
        </Stack>
        <Text
          variant="caption"
          sx={{ color: theme.colors.textSecondary, mt: 1 }}
          label={props.subtitle}
        />
      </Box>
      <Divider />
      <Box sx={{ p: 4 }}>{props.children}</Box>
    </Card>
  );
}

function LinkLine() {
  const theme = useTheme();
  return (
    <Box sx={{ alignItems: 'center', py: 1 }}>
      <Box
        style={{
          width: 2,
          height: 28,
          backgroundColor: theme.colors.border,
        }}
      />
    </Box>
  );
}

function ServerPanel(props: {
  topic: string;
  count: number;
  clientCount: number;
}) {
  const { t } = useLingui();
  const { topic, clientCount } = props;
  return (
    <SimPanel
      title={t`Server`}
      subtitle={t`Topic: ${topic} · ${clientCount} connections`}
    >
      <Text variant="caption" label={t`Committed count`} />
      <Text variant="heading" label={String(props.count)} />
    </SimPanel>
  );
}

function ClientPanel(props: { client: SimClient }) {
  const { t } = useLingui();
  const { label, id, room } = props.client;
  const count = readSimCount(room);
  return (
    <SimPanel title={t`Client ${label}`} subtitle={t`Connection ${id}`}>
      <Text variant="heading" label={String(count)} />
      <Button title={t`+1`} onPress={() => room.dispatch(Increment({}))} />
    </SimPanel>
  );
}

export function PlaygroundPage() {
  const { t } = useLingui();
  const { colors } = useTheme();
  const { sim, error } = useRoomSim();
  const serverCount = readSimCount(sim?.clients[0]?.room ?? null);

  return (
    <ScrollView sx={{ flex: 1, px: 4, py: 3 }}>
      <Stack spacing={3} sx={{ pb: 8 }}>
        <Text variant="title" label={t`Room simulation`} />
        {error !== null ? (
          <Text
            variant="body"
            sx={{ color: colors.destructive }}
            label={error}
          />
        ) : (
          <Text
            variant="body"
            sx={{ color: colors.textSecondary }}
            label={t`In-memory server; each client dispatches commands through loopback transport.`}
          />
        )}
        {sim !== null ? (
          <>
            <ServerPanel
              topic={sim.topic}
              count={serverCount}
              clientCount={sim.clients.length}
            />
            {sim.clients.map((client) => (
              <Box key={client.id}>
                <LinkLine />
                <ClientPanel client={client} />
              </Box>
            ))}
          </>
        ) : error === null ? (
          <Text variant="body" label={t`Starting simulation…`} />
        ) : null}
      </Stack>
    </ScrollView>
  );
}
