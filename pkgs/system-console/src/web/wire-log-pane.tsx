import type { SimulationReportEvent } from '../types';
import { styles, t } from './theme';

export function WireLogPane(props: {
  readonly events: readonly SimulationReportEvent[];
  readonly nodeId: string;
  readonly direction: 'ingress' | 'egress';
  readonly onSelectEvent?: (event: SimulationReportEvent) => void;
}) {
  const filtered = props.events.filter((e) => {
    if (props.direction === 'ingress') return e.to === props.nodeId;
    return e.from === props.nodeId;
  });

  return (
    <div style={styles.nodePaneSql}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: `1px solid ${t.border}`,
          color: t.muted,
          fontSize: 12,
        }}
      >
        {props.direction} · {filtered.length} events
      </div>
      <div style={{ overflow: 'auto', flex: 1, padding: 8 }}>
        {filtered.length === 0 ? (
          <div style={{ color: t.muted, fontSize: 12 }}>No events</div>
        ) : (
          filtered.map((event) => (
            <button
              key={event.id}
              type="button"
              onClick={() => props.onSelectEvent?.(event)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                background: 'transparent',
                border: 'none',
                color: t.text,
                padding: '6px 4px',
                cursor: 'pointer',
                font: 'inherit',
                borderBottom: `1px solid ${t.border}`,
              }}
            >
              <div style={{ fontSize: 11, color: t.muted }}>
                {event.id} · {event.kind}
                {event.status ? ` · ${event.status}` : ''}
              </div>
              <div style={{ fontSize: 12 }}>
                {event.detail ?? event.title ?? `${event.from} → ${event.to}`}
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
