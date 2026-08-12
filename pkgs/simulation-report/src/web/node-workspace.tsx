import type { SimulationReportData } from '../types';
import { testFrameUrl } from './api-client';
import type { FlatFrame } from './frames';
import { PlayerStage } from './player-stage';
import { NodeSqlitePane } from './sql/node-sqlite-pane';
import { merge, styles } from './theme';

export function listReportNodes(
  data: SimulationReportData,
  frame: FlatFrame | null
): string[] {
  const ids = new Set<string>();
  for (const id of data.meta.actorIds) ids.add(id);
  for (const db of frame?.databases ?? []) ids.add(db.nodeId);
  ids.add('server');
  const actors = data.meta.actorIds.filter((id) => ids.has(id));
  const extras = [...ids].filter(
    (id) => id !== 'server' && !data.meta.actorIds.includes(id)
  );
  extras.sort();
  return [...actors, ...extras, 'server'];
}

export function NodeWorkspace(props: {
  readonly data: SimulationReportData;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly prevFrame: FlatFrame | null;
  readonly nodeId: string;
  readonly onSelectNode: (nodeId: string) => void;
}) {
  const nodes = listReportNodes(props.data, props.frame);
  const acting = props.frame?.step.actorId;
  const isServer = props.nodeId === 'server';
  const viewFile =
    props.frame?.views?.find((v) => v.nodeId === props.nodeId)?.file ??
    (acting === props.nodeId ? props.frame?.file : undefined);
  const previewSrc =
    !isServer && viewFile
      ? testFrameUrl(props.bucketId, props.runId, props.testId, viewFile)
      : null;

  return (
    <div style={styles.playerWorkspace}>
      <div style={styles.nodeTabBar} role="tablist" aria-label="Nodes">
        {nodes.map((id) => {
          const active = id === props.nodeId;
          const isActing = id === acting;
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
              onClick={() => props.onSelectNode(id)}
            >
              {id}
              {isActing ? ' ●' : ''}
            </button>
          );
        })}
      </div>
      <div style={styles.nodeSplit}>
        <div style={styles.nodePane}>
          {isServer ? (
            <div style={styles.mutedEmpty}>No UI for server</div>
          ) : (
            <PlayerStage
              previewFrame={props.frame}
              previewSrc={previewSrc}
              showInteractionOverlay={acting === props.nodeId}
            />
          )}
        </div>
        <div style={styles.nodePaneSql}>
          <NodeSqlitePane
            bucketId={props.bucketId}
            runId={props.runId}
            testId={props.testId}
            frame={props.frame}
            prevFrame={props.prevFrame}
            nodeId={props.nodeId}
          />
        </div>
      </div>
    </div>
  );
}
