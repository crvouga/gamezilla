import type { CSSProperties } from 'react';

import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import { merge, t } from './theme';

export function Timeline(props: {
  readonly frames: readonly FlatFrame[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}) {
  if (props.frames.length === 0) {
    return <div style={rail}>No frames.</div>;
  }

  return (
    <div style={rail} role="listbox" aria-label="Frames">
      {props.frames.map((frame, index) => {
        const selected = index === props.selectedIndex;
        return (
          <button
            key={`${frame.file}-${index}`}
            type="button"
            role="option"
            aria-selected={selected}
            style={merge(tick, selected ? tickActive : null)}
            onClick={() => props.onSelect(index)}
            title={frame.step.title}
          >
            <span style={{ fontWeight: 600 }}>{index + 1}</span>
            <span style={{ color: t.muted, fontSize: 11 }}>
              {frame.step.kind}
            </span>
            <span style={{ color: t.muted, fontSize: 11 }}>
              {formatMs(frame.durationMs)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

const rail: CSSProperties = {
  display: 'flex',
  gap: 6,
  padding: '6px 0 10px',
  overflowX: 'auto',
  background: t.panel,
  minHeight: 52,
};

const tick: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: 2,
  minWidth: 72,
  padding: '6px 8px',
  background: t.bg,
  border: `1px solid ${t.border}`,
  borderRadius: 4,
  color: t.text,
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 12,
};

const tickActive: CSSProperties = {
  borderColor: t.accent,
  boxShadow: `inset 0 0 0 1px ${t.accent}`,
};
