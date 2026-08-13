import type { CSSProperties } from 'react';

import type { SimulationReportTopology } from '../types';
import { merge, styles, t } from './theme';

export function TopologyView(props: {
  readonly topology: SimulationReportTopology | null;
  readonly highlightEdge?: {
    readonly from: string;
    readonly to: string;
  } | null;
  readonly onSelectNode: (nodeId: string) => void;
}) {
  const topology = props.topology;
  if (!topology) {
    return (
      <div style={styles.playerWorkspace}>
        <div style={merge(styles.nodePane, { padding: 16 })}>
          No topology.json for this run (legacy report). Select a node tab below
          once available, or re-run with the topology-aware simulator.
        </div>
      </div>
    );
  }

  const clients = topology.nodes.filter((n) =>
    (topology.definition.kinds[n.kind]?.attributes ?? []).includes('html')
  );
  const servers = topology.nodes.filter((n) => n.kind === 'server');
  const brokers = topology.nodes.filter(
    (n) => n.kind === 'broker' || n.kind === 'pubsub'
  );
  const others = topology.nodes.filter(
    (n) => !clients.includes(n) && !servers.includes(n) && !brokers.includes(n)
  );

  return (
    <div style={styles.playerWorkspace}>
      <div style={merge(styles.nodePane, { padding: 16, gap: 16 })}>
        <div style={{ color: t.muted, fontSize: 12 }}>
          Topology · seed {topology.seed}
          {topology.fuzz?.enabled
            ? ` · fuzz intensity ${topology.fuzz.intensity}`
            : ''}
          {' · '}
          click a node to focus
        </div>
        <div style={layerRow}>
          <Column
            title="Clients"
            nodes={clients}
            edges={topology.edges}
            highlightEdge={props.highlightEdge ?? null}
            onSelectNode={props.onSelectNode}
          />
          <Column
            title="Servers"
            nodes={[...servers, ...others]}
            edges={topology.edges}
            highlightEdge={props.highlightEdge ?? null}
            onSelectNode={props.onSelectNode}
          />
          <Column
            title="Brokers"
            nodes={brokers}
            edges={topology.edges}
            highlightEdge={props.highlightEdge ?? null}
            onSelectNode={props.onSelectNode}
          />
        </div>
        <EdgeList
          edges={topology.edges}
          highlightEdge={props.highlightEdge ?? null}
        />
      </div>
    </div>
  );
}

function Column(props: {
  readonly title: string;
  readonly nodes: SimulationReportTopology['nodes'];
  readonly edges: SimulationReportTopology['edges'];
  readonly highlightEdge: { readonly from: string; readonly to: string } | null;
  readonly onSelectNode: (nodeId: string) => void;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ color: t.muted, fontSize: 11, textTransform: 'uppercase' }}>
        {props.title}
      </div>
      {props.nodes.length === 0 ? (
        <div style={{ color: t.muted, fontSize: 12 }}>—</div>
      ) : (
        props.nodes.map((node) => (
          <button
            key={node.id}
            type="button"
            style={nodeCard(node.status)}
            onClick={() => props.onSelectNode(node.id)}
          >
            <div style={{ fontWeight: 600 }}>{node.id}</div>
            <div style={{ color: t.muted, fontSize: 11 }}>
              {node.kind} · {node.status}
            </div>
            <div style={{ color: t.muted, fontSize: 11 }}>
              {node.attributes.join(' · ') || 'no attrs'}
            </div>
          </button>
        ))
      )}
    </div>
  );
}

function EdgeList(props: {
  readonly edges: SimulationReportTopology['edges'];
  readonly highlightEdge: { readonly from: string; readonly to: string } | null;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ color: t.muted, fontSize: 11, textTransform: 'uppercase' }}>
        Edges
      </div>
      {props.edges.map((edge) => {
        const hi =
          props.highlightEdge?.from === edge.from &&
          props.highlightEdge?.to === edge.to;
        return (
          <div
            key={`${edge.from}-${edge.to}-${edge.kind}`}
            style={{
              fontSize: 12,
              color: edge.state === 'down' ? '#f07178' : hi ? t.accent : t.text,
              borderLeft:
                edge.kind === 'pubsub'
                  ? `2px dashed ${edgeColor(edge.state)}`
                  : `2px solid ${edgeColor(edge.state)}`,
              paddingLeft: 8,
            }}
          >
            {edge.from} → {edge.to} · {edge.kind} · {edge.state}
            {edge.dropRate > 0 ? ` · drop ${edge.dropRate}` : ''}
            {edge.latencyMs > 0 ? ` · latency ${edge.latencyMs}ms` : ''}
          </div>
        );
      })}
    </div>
  );
}

const layerRow: CSSProperties = {
  display: 'flex',
  gap: 16,
  alignItems: 'flex-start',
};

function nodeCard(status: string): CSSProperties {
  return {
    textAlign: 'left',
    background: t.panel,
    border: `1px solid ${status === 'crashed' ? '#f07178' : t.border}`,
    borderRadius: 6,
    padding: '10px 12px',
    color: t.text,
    cursor: 'pointer',
  };
}

function edgeColor(state: string): string {
  if (state === 'down') return '#f07178';
  if (state === 'hold') return '#e6b450';
  return '#3dd68c';
}
