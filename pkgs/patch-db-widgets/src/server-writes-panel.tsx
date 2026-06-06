import { Trans, useLingui } from '@lingui/react/macro';
import {
  clearServerWriteEventRing,
  recentServerWriteEvents,
  SERVER_WRITE_TOPIC,
  type ServerWriteEvent,
  type ServerWriteOutcome,
} from '@pkgs/patch-db/impl-sync';
import { usePubSub } from '@pkgs/patch-db/react';
import {
  Box,
  Button,
  Card,
  Divider,
  EmptyState,
  ScrollView,
  Stack,
  StatusDot,
  Text,
} from '@pkgs/ui';
import { useTheme } from '@pkgs/ui/theme';
import { useCallback, useEffect, useState } from 'react';

type LinguiT = ReturnType<typeof useLingui>['t'];

function outcomeLabel(outcome: ServerWriteOutcome, t: LinguiT): string {
  switch (outcome) {
    case 'accepted':
      return t`Accepted`;
    case 'rejected':
      return t`Rejected by server`;
    case 'transport_rejected':
      return t`Auth rejected`;
    case 'error':
      return t`Transport error`;
  }
}

function outcomeStatus(
  outcome: ServerWriteOutcome
): 'online' | 'warning' | 'offline' {
  if (outcome === 'accepted') return 'online';
  if (outcome === 'rejected') return 'warning';
  return 'offline';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

function PatchSummaryRow({
  patch,
  isLast,
}: {
  patch: ServerWriteEvent['patches'][number];
  isLast: boolean;
}) {
  const theme = useTheme();
  return (
    <Box>
      <Stack
        direction="horizontal"
        spacing={3}
        sx={{ px: 4, py: 2.5 }}
        align="center"
      >
        <Text
          variant="mono"
          style={{ flex: 1, fontSize: 12, color: theme.colors.tint }}
          label={patch.entityType}
        />
        <Text
          variant="mono"
          style={{ flex: 1, fontSize: 12, textAlign: 'right' }}
          label={patch.entityId.slice(0, 12)}
        />
      </Stack>
      {!isLast && <Divider />}
    </Box>
  );
}

function RejectionRows({
  rejected,
}: {
  rejected: ServerWriteEvent['rejected'];
}) {
  const theme = useTheme();
  if (rejected.length === 0) return null;
  return (
    <Box sx={{ px: 4, py: 2, backgroundColor: theme.colors.surfaceMuted }}>
      {rejected.map((r) => (
        <Text
          key={r.patchId}
          variant="mono"
          style={{
            fontSize: 11,
            color: theme.colors.destructive,
            marginBottom: 4,
          }}
          label={`${r.code}: ${r.reason}`}
        />
      ))}
    </Box>
  );
}

function WriteEventErrorSection({
  httpStatus,
  errorMessage,
}: {
  httpStatus: number | undefined;
  errorMessage: string | undefined;
}) {
  const { t } = useLingui();
  const theme = useTheme();
  if (httpStatus === undefined && errorMessage === undefined) return null;
  return (
    <>
      <Divider />
      <Box sx={{ px: 4, py: 3 }}>
        {httpStatus !== undefined && (
          <Text
            variant="mono"
            style={{ fontSize: 12, marginBottom: 4 }}
            label={t`HTTP ${httpStatus}`}
          />
        )}
        {errorMessage !== undefined && (
          <Text
            variant="mono"
            style={{ fontSize: 12, color: theme.colors.destructive }}
            label={errorMessage}
          />
        )}
      </Box>
    </>
  );
}

function WriteEventCard({ event }: { event: ServerWriteEvent }) {
  const { t } = useLingui();
  const theme = useTheme();
  const status = outcomeStatus(event.outcome);
  const label = outcomeLabel(event.outcome, t);
  const patchCount = event.patches.length;
  const entityTypes = [...new Set(event.patches.map((p) => p.entityType))].join(
    ', '
  );
  const timeLabel = formatTime(event.at);

  return (
    <Card elevation={1}>
      <Stack
        direction="horizontal"
        spacing={3}
        align="center"
        sx={{ px: 4, py: 3 }}
      >
        <StatusDot status={status} size={10} />
        <Box sx={{ flex: 1 }}>
          <Text variant="bodyBold" label={label} />
          <Text
            variant="caption"
            style={{ color: theme.colors.textSecondary, marginTop: 2 }}
            label={t`${timeLabel} · ${patchCount} patches · ${entityTypes}`}
          />
        </Box>
      </Stack>
      <WriteEventErrorSection
        httpStatus={event.httpStatus}
        errorMessage={event.errorMessage}
      />
      {event.rejected.length > 0 && (
        <>
          <Divider />
          <RejectionRows rejected={event.rejected} />
        </>
      )}
      {event.patches.length > 0 && (
        <>
          <Divider />
          {event.patches.map((patch, i) => (
            <PatchSummaryRow
              key={patch.patchId}
              patch={patch}
              isLast={i === event.patches.length - 1}
            />
          ))}
        </>
      )}
    </Card>
  );
}

function useServerWriteEvents(): {
  events: readonly ServerWriteEvent[];
  clear: () => void;
} {
  const pubSub = usePubSub();
  const [events, setEvents] = useState<readonly ServerWriteEvent[]>(() =>
    recentServerWriteEvents()
  );

  useEffect(() => {
    setEvents(recentServerWriteEvents());
    return pubSub.subscribe(SERVER_WRITE_TOPIC, () => {
      setEvents([...recentServerWriteEvents()]);
    });
  }, [pubSub]);

  const clear = useCallback(() => {
    clearServerWriteEventRing();
    setEvents([]);
  }, []);

  return { events, clear };
}

export function ServerWritesPanel() {
  const { t } = useLingui();
  const { events, clear } = useServerWriteEvents();

  return (
    <ScrollView style={{ flex: 1 }} sx={{ p: 4 }}>
      <Stack spacing={4}>
        <Stack direction="horizontal" spacing={2} align="center">
          <Box sx={{ flex: 1 }}>
            <Text variant="bodyBold" label={<Trans>Server writes</Trans>} />
            <Text
              variant="caption"
              label={
                <Trans>
                  Live log of patch pushes to the remote patch-db API
                </Trans>
              }
            />
          </Box>
          {events.length > 0 && (
            <Button
              title={<Trans>Clear</Trans>}
              intent="neutral"
              size="sm"
              onPress={clear}
            />
          )}
        </Stack>
        {events.length === 0 ? (
          <EmptyState
            title={t`No server writes yet`}
            body={t`Create or edit data locally — pushes appear here with success or failure details.`}
          />
        ) : (
          events.map((event) => <WriteEventCard key={event.id} event={event} />)
        )}
      </Stack>
    </ScrollView>
  );
}
