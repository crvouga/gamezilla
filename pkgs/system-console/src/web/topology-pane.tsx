import type { CSSProperties } from 'react';

import type { SimulationReportTopology } from '../types';
import { merge, styles, t } from './theme';

export function TopologyPane(props: {
  readonly topology: SimulationReportTopology | null;
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (nodeId: string) => void;
}) {
  const topology = props.topology;
  if (!topology) {
    return (
      <div style={pane}>
        <div style={styles.empty}>No topology.json for this run.</div>
      </div>
    );
  }

  const byKind = new Map<string, SimulationReportTopology['nodes'][number][]>();
  for (const node of topology.nodes) {
    const list = byKind.get(node.kind) ?? [];
    list.push(node);
    byKind.set(node.kind, list);
  }
  const kinds = [...byKind.keys()].sort();

  return (
    <div style={pane}>
      <div style={meta}>
        Topology · seed {topology.seed} · click a node for SQLite
      </div>
      {kinds.map((kind) => (
        <Group
          key={kind}
          title={kind}
          nodes={byKind.get(kind) ?? []}
          selectedNodeId={props.selectedNodeId}
          onSelectNode={props.onSelectNode}
        />
      ))}
      <div style={sectionTitle}>Edges</div>
      {topology.edges.map((edge) => (
        <div
          key={`${edge.from}-${edge.to}-${edge.kind}`}
          style={{
            fontSize: 12,
            color: edge.state === 'down' ? '#f07178' : t.text,
            paddingLeft: 8,
            borderLeft: `2px solid ${
              edge.state === 'down' ? '#f07178' : '#3dd68c'
            }`,
          }}
        >
          {edge.from} → {edge.to} · {edge.kind} · {edge.state}
        </div>
      ))}
    </div>
  );
}

function Group(props: {
  readonly title: string;
  readonly nodes: SimulationReportTopology['nodes'];
  readonly selectedNodeId: string | null;
  readonly onSelectNode: (nodeId: string) => void;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={sectionTitle}>{props.title}</div>
      {props.nodes.length === 0 ? (
        <div style={{ color: t.muted, fontSize: 12 }}>—</div>
      ) : (
        props.nodes.map((node) => {
          const selected = node.id === props.selectedNodeId;
          return (
            <button
              key={node.id}
              type="button"
              style={merge(nodeBtn, selected ? nodeBtnActive : null)}
              onClick={() => props.onSelectNode(node.id)}
            >
              <div style={{ fontWeight: 600 }}>{node.id}</div>
              <div style={{ color: t.muted, fontSize: 11 }}>
                {node.kind} · {node.status}
              </div>
            </button>
          );
        })
      )}
    </div>
  );
}

const pane: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: 12,
  minHeight: 0,
  overflow: 'auto',
  borderRight: `1px solid ${t.border}`,
  background: t.panel,
};

const meta: CSSProperties = { color: t.muted, fontSize: 12 };

const sectionTitle: CSSProperties = {
  color: t.muted,
  fontSize: 11,
  textTransform: 'uppercase',
};

const nodeBtn: CSSProperties = {
  textAlign: 'left',
  background: t.bg,
  border: `1px solid ${t.border}`,
  borderRadius: 6,
  padding: '8px 10px',
  color: t.text,
  cursor: 'pointer',
};

const nodeBtnActive: CSSProperties = {
  borderColor: t.accent,
  boxShadow: `inset 0 0 0 1px ${t.accent}`,
};
