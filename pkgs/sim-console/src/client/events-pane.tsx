import { ScrollView } from '@pkgs/ui';
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
        <div class="box" style={paneSx}>
          <p class="text" style={emptySx}>
            Select a node to view events.
          </p>
        </div>
      </Match>
      <Match when={props.error != null}>
        <div class="box" style={paneSx}>
          <p class="text" style={emptySx}>
            Failed to load events: {props.error}
          </p>
        </div>
      </Match>
      <Match when={props.events == null}>
        <div class="box" style={paneSx}>
          <p class="text" style={emptySx}>
            Loading events…
          </p>
        </div>
      </Match>
      <Match when={rows().length === 0}>
        <div class="box" style={paneSx}>
          <p class="text" style={emptySx}>
            No events for node `{props.nodeId}` on this frame.
          </p>
        </div>
      </Match>
      <Match when={true}>
        <ScrollView style={paneSx} contentClass="gap-1 p-[3px]">
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
    <div class="box flex-row items-baseline gap-2.5 [padding-top:6px;padding-bottom:6px] [padding-left:8px;padding-right:8px] border border-border rounded-[10px] bg-surface flex-wrap">
      <p class="text text-text-secondary min-w-[56px] text-[12px]">
        {formatMs(event.atMs)}
      </p>
      <p class="text text-[10px] uppercase tracking-[0.4px] text-tint min-w-[52px]">
        {dir}
      </p>
      <p class="text font-semibold text-text text-[12px]">{event.kind}</p>
      <p class="text line-clamp-1 text-text-secondary flex-1 text-[12px] min-w-[80px]">
        {event.title ?? event.detail ?? '—'}
      </p>
      <p class="text text-text-secondary text-[11px]">
        {[event.from, event.to].filter(Boolean).join(' → ') || event.nodeId}
      </p>
    </div>
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
