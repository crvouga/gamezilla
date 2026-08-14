import { Box, ScrollView, Text } from '@pkgs/ui';
import { useEffect, useMemo, useState } from 'react';

import type { SimulationReportEvent } from '../types';
import type { ReportApiClient } from './api-client';
import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import { emptySx, paneSx, t } from './tokens';

export function EventsPane(props: {
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly nodeId: string | null;
}) {
  const { events, error } = useTestEvents(
    props.api,
    props.bucketId,
    props.runId,
    props.testId
  );
  const rows = useMemo(
    () => filterNodeEvents(events, props.nodeId, props.frame?.capturedAtMs),
    [events, props.nodeId, props.frame?.capturedAtMs]
  );

  if (props.nodeId == null) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>Select a node to view events.</Text>
      </Box>
    );
  }
  if (error != null) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>Failed to load events: {error}</Text>
      </Box>
    );
  }
  if (events == null) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>Loading events…</Text>
      </Box>
    );
  }
  if (rows.length === 0) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>
          No events for node `{props.nodeId}` on this frame.
        </Text>
      </Box>
    );
  }
  return (
    <ScrollView frameSx={paneSx} sx={{ gap: 4, padding: 12 }}>
      {rows.map((row) => (
        <EventRow key={row.event.id} row={row} />
      ))}
    </ScrollView>
  );
}

function EventRow(props: {
  readonly row: { readonly event: SimulationReportEvent; readonly dir: string };
}) {
  const { event, dir } = props.row;
  return (
    <Box sx={rowStyleSx}>
      <Text sx={{ color: t.muted, minWidth: 56, fontSize: 12 }}>
        {formatMs(event.atMs)}
      </Text>
      <Text sx={dirBadgeSx}>{dir}</Text>
      <Text sx={{ fontWeight: '600', color: t.text, fontSize: 12 }}>
        {event.kind}
      </Text>
      <Text sx={{ color: t.muted, flex: 1, fontSize: 12 }} numberOfLines={1}>
        {event.title ?? event.detail ?? '—'}
      </Text>
      <Text sx={{ color: t.muted, fontSize: 11 }}>
        {[event.from, event.to].filter(Boolean).join(' → ') || event.nodeId}
      </Text>
    </Box>
  );
}

function useTestEvents(
  api: ReportApiClient,
  bucketId: string,
  runId: string,
  testId: string
): {
  events: readonly SimulationReportEvent[] | null;
  error: string | null;
} {
  const [events, setEvents] = useState<readonly SimulationReportEvent[] | null>(
    null
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError(null);
    void api
      .fetchTestEvents(bucketId, runId, testId)
      .then((list) => {
        if (!cancelled) setEvents(list);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : String(err));
        }
      });
    return () => {
      cancelled = true;
    };
  }, [api, bucketId, runId, testId]);

  return { events, error };
}

function filterNodeEvents(
  events: readonly SimulationReportEvent[] | null,
  nodeId: string | null,
  atMs: number | undefined
): readonly { event: SimulationReportEvent; dir: string }[] {
  if (events == null || nodeId == null) return [];
  const cutoff = atMs ?? Number.POSITIVE_INFINITY;
  const out: { event: SimulationReportEvent; dir: string }[] = [];
  for (const event of events) {
    if (event.atMs > cutoff) continue;
    const dir = eventDirection(event, nodeId);
    if (dir == null) continue;
    out.push({ event, dir });
  }
  return out;
}

function eventDirection(
  event: SimulationReportEvent,
  nodeId: string
): string | null {
  if (event.to === nodeId) return 'ingress';
  if (event.from === nodeId) return 'egress';
  if (event.nodeId === nodeId) return 'local';
  return null;
}

const rowStyleSx = {
  flexDirection: 'row',
  alignItems: 'baseline',
  gap: 10,
  paddingVertical: 6,
  paddingHorizontal: 8,
  borderWidth: 1,
  borderColor: t.border,
  borderRadius: 4,
  backgroundColor: t.panel,
} as const;

const dirBadgeSx = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: t.accent,
  minWidth: 52,
} as const;
