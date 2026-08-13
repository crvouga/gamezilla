import type { CSSProperties } from 'react';

import { merge, t } from './theme';

export type TabItem = {
  readonly id: string;
  readonly label: string;
};

export function TabBar(props: {
  readonly label: string;
  readonly items: readonly TabItem[];
  readonly selectedId: string | null;
  readonly onSelect: (id: string) => void;
}) {
  if (props.items.length === 0) {
    return <div style={bar} aria-label={props.label} />;
  }
  return (
    <div style={bar} role="tablist" aria-label={props.label}>
      {props.items.map((item) => {
        const selected = item.id === props.selectedId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            style={merge(tab, selected ? tabActive : null)}
            onClick={() => props.onSelect(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

const bar: CSSProperties = {
  display: 'flex',
  gap: 4,
  padding: '6px 12px',
  overflowX: 'auto',
  borderBottom: `1px solid ${t.border}`,
  background: t.panel,
  minHeight: 36,
  flex: '0 0 auto',
};

const tab: CSSProperties = {
  appearance: 'none',
  border: `1px solid ${t.border}`,
  background: t.control,
  color: t.text,
  borderRadius: 4,
  padding: '4px 10px',
  cursor: 'pointer',
  font: 'inherit',
  fontSize: 12,
  whiteSpace: 'nowrap',
};

const tabActive: CSSProperties = {
  borderColor: t.accent,
  background: t.accentSoft,
  color: t.accent,
  boxShadow: `inset 0 0 0 1px ${t.accent}`,
};
