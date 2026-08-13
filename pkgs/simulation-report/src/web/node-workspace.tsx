import type {
  SimulationReportData,
  SimulationReportEvent,
  SimulationReportTopology,
} from '../types';
import { testFrameUrl } from './api-client';
import type { FlatFrame } from './frames';
import { PlayerStage } from './player-stage';
import { NodeSqlitePane } from './sql/node-sqlite-pane';
import { merge, styles } from './theme';
import { TopologyView } from './topology-view';
import { WireLogPane } from './wire-log-pane';

export function listReportNodes(
  data: SimulationReportData,
  frame: FlatFrame | null,
  topology: SimulationReportTopology | null
): string[] {
  if (topology) {
    return topology.nodes.map((n) => n.id);
  }
  const ids = new Set<string>();
  for (const id of data.meta.actorIds) ids.add(id);
  for (const db of frame?.databases ?? []) ids.add(db.nodeId);
  for (const attr of frame?.attributes ?? []) ids.add(attr.nodeId);
  ids.add('server');
  const actors = data.meta.actorIds.filter((id) => ids.has(id));
  const extras = [...ids].filter(
    (id) => id !== 'server' && !data.meta.actorIds.includes(id)
  );
  extras.sort();
  return [...actors, ...extras, 'server'];
}

export function nodeAttributes(
  topology: SimulationReportTopology | null,
  data: SimulationReportData,
  nodeId: string
): string[] {
  const fromTopo = topology?.nodes.find((n) => n.id === nodeId)?.attributes;
  if (fromTopo && fromTopo.length > 0) return [...fromTopo];
  if (data.meta.actorIds.includes(nodeId)) {
    return ['html', 'sqlite', 'ingress', 'egress'];
  }
  return ['sqlite', 'ingress', 'egress'];
}

export function NodeWorkspace(props: {
  readonly data: SimulationReportData;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly prevFrame: FlatFrame | null;
  readonly nodeId: string | null;
  readonly attr: string | null;
  readonly topology: SimulationReportTopology | null;
  readonly events: readonly SimulationReportEvent[];
  readonly onSelectNode: (nodeId: string | null) => void;
  readonly onSelectAttr: (attr: string) => void;
  readonly onSelectEvent?: (event: SimulationReportEvent) => void;
}) {
  if (props.nodeId == null) {
    return (
      <TopologyView
        topology={props.topology}
        onSelectNode={(id) => props.onSelectNode(id)}
      />
    );
  }

  const nodes = listReportNodes(props.data, props.frame, props.topology);
  const attrs = nodeAttributes(props.topology, props.data, props.nodeId);
  const attr = props.attr && attrs.includes(props.attr) ? props.attr : attrs[0];
  const acting = props.frame?.step.actorId;
  const focusedNodeId = props.nodeId;

  return (
    <div style={styles.playerWorkspace}>
      <NodeTabBar
        nodes={nodes}
        nodeId={focusedNodeId}
        acting={acting}
        onSelectNode={props.onSelectNode}
      />
      <AttrTabBar attrs={attrs} attr={attr} onSelectAttr={props.onSelectAttr} />
      <NodeAttrBody
        bucketId={props.bucketId}
        runId={props.runId}
        testId={props.testId}
        frame={props.frame}
        prevFrame={props.prevFrame}
        nodeId={focusedNodeId}
        events={props.events}
        attr={attr}
        acting={acting}
        showUiPane={attr === 'html'}
        showSql={attr === 'sqlite'}
        showWire={attr === 'ingress' || attr === 'egress'}
        {...(props.onSelectEvent !== undefined
          ? { onSelectEvent: props.onSelectEvent }
          : {})}
      />
    </div>
  );
}

function NodeTabBar(args: {
  readonly nodes: readonly string[];
  readonly nodeId: string;
  readonly acting: string | undefined;
  readonly onSelectNode: (nodeId: string | null) => void;
}) {
  return (
    <div style={styles.nodeTabBar} role="tablist" aria-label="Nodes">
      <button
        type="button"
        role="tab"
        aria-selected={false}
        style={styles.nodeTabBtn}
        onClick={() => args.onSelectNode(null)}
      >
        topology
      </button>
      {args.nodes.map((id) => {
        const active = id === args.nodeId;
        const isActing = id === args.acting;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={active}
            style={merge(
              active ? styles.nodeTabBtnActive : styles.nodeTabBtn,
              isActing && !active
                ? { boxShadow: 'inset 0 -2px 0 #3dd68c' }
                : null
            )}
            onClick={() => args.onSelectNode(id)}
          >
            {id}
            {isActing ? ' ●' : ''}
          </button>
        );
      })}
    </div>
  );
}

function AttrTabBar(args: {
  readonly attrs: readonly string[];
  readonly attr: string | undefined;
  readonly onSelectAttr: (attr: string) => void;
}) {
  return (
    <div style={styles.nodeTabBar} role="tablist" aria-label="Attributes">
      {args.attrs.map((a) => (
        <button
          key={a}
          type="button"
          role="tab"
          aria-selected={a === args.attr}
          style={a === args.attr ? styles.nodeTabBtnActive : styles.nodeTabBtn}
          onClick={() => args.onSelectAttr(a)}
        >
          {a}
        </button>
      ))}
    </div>
  );
}

function NodeAttrBody(args: {
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly prevFrame: FlatFrame | null;
  readonly nodeId: string;
  readonly events: readonly SimulationReportEvent[];
  readonly onSelectEvent?: (event: SimulationReportEvent) => void;
  readonly attr: string | undefined;
  readonly acting: string | undefined;
  readonly showUiPane: boolean;
  readonly showSql: boolean;
  readonly showWire: boolean;
}) {
  const { attr, acting, showUiPane, showSql, showWire } = args;
  const viewFile =
    args.frame?.views?.find((v) => v.nodeId === args.nodeId)?.file ??
    (acting === args.nodeId ? args.frame?.file : undefined);
  const previewSrc =
    showUiPane && viewFile
      ? testFrameUrl(args.bucketId, args.runId, args.testId, viewFile)
      : null;

  return (
    <div
      style={showUiPane || showSql ? styles.nodeSplit : styles.nodeSplitSqlOnly}
    >
      {showUiPane ? (
        <div style={styles.nodePane}>
          <PlayerStage
            previewFrame={args.frame}
            previewSrc={previewSrc}
            showInteractionOverlay={acting === args.nodeId}
          />
        </div>
      ) : null}
      {showSql ? (
        <div style={styles.nodePaneSql}>
          <NodeSqlitePane
            bucketId={args.bucketId}
            runId={args.runId}
            testId={args.testId}
            frame={args.frame}
            prevFrame={args.prevFrame}
            nodeId={args.nodeId}
          />
        </div>
      ) : null}
      {showWire ? (
        <WireLogPane
          events={args.events}
          nodeId={args.nodeId}
          direction={attr as 'ingress' | 'egress'}
          {...(args.onSelectEvent !== undefined
            ? { onSelectEvent: args.onSelectEvent }
            : {})}
        />
      ) : null}
    </div>
  );
}
