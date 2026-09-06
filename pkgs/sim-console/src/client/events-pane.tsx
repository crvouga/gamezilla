import { Box, ScrollView, Text } from '@pkgs/ui';
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  Match,
  onCleanup,
  Switch,
} from 'solid-js';

import type { SimulationReportEvent } from '../types';
import type { ReportApiClient } from './api-client';
import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import { emptySx, paneSx } from './tokens';

export function EventsPane(props: {
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly nodeId: string | null;
}) {
  const state = useTestEvents(props);
  return (
    <EventsList
      events={state.events}
      error={state.error}
      nodeId={props.nodeId}
      cutoffMs={props.frame?.capturedAtMs}
    />
  );
}

export function EventsList(props: {
  readonly events: readonly SimulationReportEvent[] | null;
  readonly error?: string | null;
  readonly nodeId: string | null;
  readonly cutoffMs: number | undefined;
}) {
  const rows = createMemo(() =>
    filterNodeEvents(props.events, props.nodeId, props.cutoffMs)
  );
  return (
    <Switch>
      <Match when={props.nodeId == null}>
        <Box sx={paneSx}>
          <Text sx={emptySx}>Select a node to view events.</Text>
        </Box>
      </Match>
      <Match when={props.error != null}>
        <Box sx={paneSx}>
          <Text sx={emptySx}>Failed to load events: {props.error}</Text>
        </Box>
      </Match>
      <Match when={props.events == null}>
        <Box sx={paneSx}>
          <Text sx={emptySx}>Loading events…</Text>
        </Box>
      </Match>
      <Match when={rows().length === 0}>
        <Box sx={paneSx}>
          <Text sx={emptySx}>
            No events for node `{props.nodeId}` on this frame.
          </Text>
        </Box>
      </Match>
      <Match when={true}>
        <ScrollView frameSx={paneSx} sx={{ gap: 1, padding: 3 }}>
          <For each={rows()}>{(row) => <EventRow row={row} />}</For>
        </ScrollView>
      </Match>
    </Switch>
  );
}

function EventRow(props: {
  readonly row: { readonly event: SimulationReportEvent; readonly dir: string };
}) {
  const { event, dir } = props.row;
  return (
    <Box
      sx={{
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 2.5,
        paddingVertical: 6,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: 'border',
        borderRadius: 'md',
        background: 'surface',
        flexWrap: 'wrap',
      }}
    >
      <Text sx={{ color: 'textSecondary', minWidth: 56, fontSize: 12 }}>
        {formatMs(event.atMs)}
      </Text>
      <Text
        sx={{
          fontSize: 10,
          textTransform: 'uppercase',
          letterSpacing: 0.4,
          color: 'tint',
          minWidth: 52,
        }}
      >
        {dir}
      </Text>
      <Text sx={{ fontWeight: '600', color: 'text', fontSize: 12 }}>
        {event.kind}
      </Text>
      <Text
        sx={{ color: 'textSecondary', flex: 1, fontSize: 12, minWidth: 80 }}
        numberOfLines={1}
      >
        {event.title ?? event.detail ?? '—'}
      </Text>
      <Text sx={{ color: 'textSecondary', fontSize: 11 }}>
        {[event.from, event.to].filter(Boolean).join(' → ') || event.nodeId}
      </Text>
    </Box>
  );
}

function useTestEvents(props: {
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
}): {
  readonly events: readonly SimulationReportEvent[] | null;
  readonly error: string | null;
} {
  const [events, setEvents] = createSignal<
    readonly SimulationReportEvent[] | null
  >(null);
  const [error, setError] = createSignal<string | null>(null);

  createEffect(() => {
    const { api, bucketId, runId, testId } = props;
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
    onCleanup(() => {
      cancelled = true;
    });
  });

  return {
    get events() {
      return events();
    },
    get error() {
      return error();
    },
  };
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
