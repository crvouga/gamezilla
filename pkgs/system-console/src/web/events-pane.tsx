import { type CSSProperties, useEffect, useMemo, useState } from 'react';

import type { SimulationReportEvent } from '../types';
import { fetchTestEvents } from './api-client';
import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import { styles, t } from './theme';

export function EventsPane(props: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly nodeId: string | null;
}) {
  const { events, error } = useTestEvents(
    props.bucketId,
    props.runId,
    props.testId
  );
  const rows = useMemo(
    () => filterNodeEvents(events, props.nodeId, props.frame?.capturedAtMs),
    [events, props.nodeId, props.frame?.capturedAtMs]
  );

  if (props.nodeId == null) {
    return <div style={pane}>Select a node to view events.</div>;
  }
  if (error != null) {
    return (
      <div style={pane}>
        <div style={styles.empty}>Failed to load events: {error}</div>
      </div>
    );
  }
  if (events == null) {
    return <div style={pane}>Loading events…</div>;
  }
  if (rows.length === 0) {
    return (
      <div style={pane}>
        <div style={styles.empty}>
          No events for node `{props.nodeId}` on this frame.
        </div>
      </div>
    );
  }
  return (
    <div style={pane}>
      <div style={list}>
        {rows.map((row) => (
          <EventRow key={row.event.id} row={row} />
        ))}
      </div>
    </div>
  );
}

function EventRow(props: {
  readonly row: { readonly event: SimulationReportEvent; readonly dir: string };
}) {
  const { event, dir } = props.row;
  return (
    <div style={rowStyle}>
      <span style={{ color: t.muted, minWidth: 56 }}>
        {formatMs(event.atMs)}
      </span>
      <span style={dirBadge}>{dir}</span>
      <span style={{ fontWeight: 600 }}>{event.kind}</span>
      <span style={{ color: t.muted, flex: 1, minWidth: 0 }}>
        {event.title ?? event.detail ?? '—'}
      </span>
      <span style={{ color: t.muted, fontSize: 11 }}>
        {[event.from, event.to].filter(Boolean).join(' → ') || event.nodeId}
      </span>
    </div>
  );
}

function useTestEvents(
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
    void fetchTestEvents(bucketId, runId, testId)
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
  }, [bucketId, runId, testId]);

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

const pane: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0,
  height: '100%',
  background: t.bg,
  overflow: 'auto',
};

const list: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  padding: 12,
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 10,
  padding: '6px 8px',
  border: `1px solid ${t.border}`,
  borderRadius: 4,
  background: t.panel,
  fontSize: 12,
};

const dirBadge: CSSProperties = {
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  color: t.accent,
  minWidth: 52,
};
