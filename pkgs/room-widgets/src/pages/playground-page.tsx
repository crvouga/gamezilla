import { useLingui } from '@lingui/react/macro';
import {
  assignParticipantColors,
  groupRosterByParticipant,
  type LogLineContext,
  type LogLineDraft,
  projectEventLog,
} from '@pkgs/collab';
import { EventLogBar, ParticipantDot, PresenceStrip } from '@pkgs/collab-ui';
import { asLocalized } from '@pkgs/i18n';
import { createMessageNamespace, createMessageRouter } from '@pkgs/message';
import {
  Avatar,
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
import { type ReactNode, useEffect, useMemo, useState } from 'react';

import {
  Increment,
  readSimCount,
  type SimClient,
  useRoomSim,
} from './use-room-sim';

const counterEvtNs = createMessageNamespace('space-counter-evt');
const CounterIncremented = counterEvtNs(
  'counter-incremented',
  (p): p is Record<string, never> =>
    typeof p === 'object' && p !== null && Object.keys(p).length === 0
);

const demoLogRouter = createMessageRouter<
  void,
  LogLineContext,
  LogLineDraft | null
>(counterEvtNs).on(CounterIncremented, () => ({
  text: asLocalized('+1'),
  targetKeys: ['counter/count'],
}));

function roomTickFingerprint(rooms: readonly SimClient['room'][]): number {
  return rooms.reduce(
    (acc, r) => acc + r.getLog().length + r.getRoster().length,
    0
  );
}

function subscribeRoomBump(
  room: SimClient['room'],
  bump: () => void
): () => void {
  return room.subscribe(bump);
}

function useRoomTick(rooms: readonly SimClient['room'][]): number {
  const [, setTick] = useState(0);
  useEffect(() => {
    const bump = () => setTick((n) => n + 1);
    const unsubs = rooms.map((room) => subscribeRoomBump(room, bump));
    return () => {
      for (const u of unsubs) u();
    };
  }, [rooms]);
  return roomTickFingerprint(rooms);
}

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

function RosterPanel(props: { clients: readonly SimClient[] }) {
  const { t } = useLingui();
  const rooms = useMemo(
    () => props.clients.map((c) => c.room),
    [props.clients]
  );
  useRoomTick(rooms);
  const roster = props.clients[0]?.room.getRoster() ?? [];
  const colors = assignParticipantColors(roster.map((c) => c.id));
  const flat = groupRosterByParticipant(roster, null).flatMap((p) => p.clients);
  const connectedCount = flat.length;

  return (
    <SimPanel
      title={t`Roster`}
      subtitle={t`${connectedCount} connected clients`}
    >
      <PresenceStrip
        clients={flat}
        colorForParticipant={(id) => colors.get(id)?.css ?? '#888'}
        renderAvatar={(actor, size) => (
          <Avatar size={size} initials={actor.id.slice(0, 2).toUpperCase()} />
        )}
        size={28}
      />
      <Stack spacing={1} sx={{ mt: 3 }}>
        {flat.map((c) => (
          <Stack
            key={c.clientId}
            direction="horizontal"
            spacing={2}
            align="center"
          >
            <ParticipantDot color={colors.get(c.id)?.css ?? '#888'} />
            <Text
              variant="caption"
              label={`${c.id} · ${c.clientId.slice(0, 8)}`}
            />
          </Stack>
        ))}
      </Stack>
    </SimPanel>
  );
}

function LogPanel(props: { client: SimClient | null }) {
  const { t } = useLingui();
  const room = props.client?.room ?? null;
  const rooms = useMemo(() => (room !== null ? [room] : []), [room]);
  useRoomTick(rooms);
  const lines =
    room === null ? [] : projectEventLog(room.getLog(), demoLogRouter);
  const actorIds = lines
    .map((l) => l.actor?.id)
    .filter((id): id is string => typeof id === 'string');
  const colors = assignParticipantColors(actorIds);
  const latest = lines.length > 0 ? lines[lines.length - 1]! : null;
  const lineCount = lines.length;

  return (
    <SimPanel title={t`Event log`} subtitle={t`${lineCount} lines`}>
      <EventLogBar
        latest={latest}
        copy={{
          empty: asLocalized(t`No activity yet`),
          reconnecting: asLocalized(t`Reconnecting…`),
          unreadLabel: (n) => asLocalized(t`${n} new`),
        }}
        colorForActor={(actor) => colors.get(actor.id)?.css ?? '#888'}
      />
      <Text
        variant="caption"
        sx={{ mt: 2 }}
        label={
          latest !== null
            ? `seq ${String(latest.seq)} · ${String(latest.text)}`
            : t`Dispatch +1 to append.`
        }
      />
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
            <LinkLine />
            <RosterPanel clients={sim.clients} />
            <LinkLine />
            <LogPanel client={sim.clients[0] ?? null} />
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
