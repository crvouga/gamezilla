import type { SimulationReportEvent } from '../types';
import { merge, t } from './theme';

export type EventStripFilter = 'all' | 'ui' | 'http' | 'pubsub' | 'knobs';

export function EventStrip(props: {
  readonly events: readonly SimulationReportEvent[];
  readonly filter: EventStripFilter;
  readonly onFilter: (filter: EventStripFilter) => void;
  readonly selectedId: string | null;
  readonly onSelect: (event: SimulationReportEvent) => void;
}) {
  const filters: EventStripFilter[] = ['all', 'ui', 'http', 'pubsub', 'knobs'];
  const visible = props.events.filter((e) => matchesFilter(e, props.filter));

  return (
    <div
      style={{
        borderTop: `1px solid ${t.border}`,
        background: t.panel,
        maxHeight: 140,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div style={{ display: 'flex', gap: 6, padding: '6px 10px' }}>
        {filters.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => props.onFilter(f)}
            style={merge(
              {
                background: 'transparent',
                border: `1px solid ${t.border}`,
                color: t.muted,
                borderRadius: 4,
                padding: '2px 8px',
                cursor: 'pointer',
                fontSize: 11,
              },
              props.filter === f
                ? { color: t.text, borderColor: t.accent }
                : null
            )}
          >
            {f}
          </button>
        ))}
        <span style={{ color: t.muted, fontSize: 11, marginLeft: 'auto' }}>
          {visible.length} events
        </span>
      </div>
      <div
        style={{
          overflow: 'auto',
          display: 'flex',
          gap: 4,
          padding: '0 8px 8px',
        }}
      >
        {visible.map((event) => (
          <button
            key={event.id}
            type="button"
            onClick={() => props.onSelect(event)}
            style={{
              flex: '0 0 auto',
              background:
                props.selectedId === event.id ? t.accent : 'transparent',
              color: props.selectedId === event.id ? '#000' : t.text,
              border: `1px solid ${t.border}`,
              borderRadius: 4,
              padding: '4px 8px',
              fontSize: 11,
              cursor: 'pointer',
            }}
            title={event.detail ?? event.title ?? event.kind}
          >
            {shortKind(event.kind)}
          </button>
        ))}
      </div>
    </div>
  );
}

function matchesFilter(
  event: SimulationReportEvent,
  filter: EventStripFilter
): boolean {
  if (filter === 'all') return true;
  if (filter === 'ui') return event.kind.startsWith('ui.');
  if (filter === 'http') return event.kind.startsWith('http.');
  if (filter === 'pubsub') {
    return event.kind.startsWith('pubsub.') || event.kind.startsWith('broker.');
  }
  return (
    event.kind.startsWith('edge.') ||
    event.kind.startsWith('node.') ||
    event.kind.startsWith('fuzz.')
  );
}

function shortKind(kind: string): string {
  const parts = kind.split('.');
  return parts[parts.length - 1] ?? kind;
}
