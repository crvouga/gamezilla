import { type CSSProperties, useEffect, useMemo, useState } from 'react';

import type {
  RunSummary,
  SimulationReportData,
  SimulationReportTopology,
  SuiteTestSummary,
} from '../types';
import type { BucketInfo } from './api-client';
import { fetchTestTopology } from './api-client';
import { EventsPane } from './events-pane';
import {
  flattenFrames,
  playheadFrameIndex,
  resolveSelectedFrameIndex,
} from './frames';
import { HtmlPane } from './html-pane';
import { NavBreadcrumb } from './nav-breadcrumb';
import {
  defaultNodeId,
  resolveNodeList,
  resolveSelectedView,
  viewsForNode,
} from './node-views';
import { PlayerStrip } from './player-strip';
import { ReportHeader } from './report-header';
import type { NodeViewKind, ReportNavState } from './router';
import { navigateReport } from './router';
import { SqlitePane } from './sqlite-pane';
import { TabBar } from './tab-bar';
import { styles, t } from './theme';

export function TestPage(props: {
  readonly data: SimulationReportData;
  readonly nav: ReportNavState;
  readonly bucketId: string;
  readonly runId: string;
  readonly buckets: readonly BucketInfo[];
  readonly runs: readonly RunSummary[];
  readonly tests: readonly SuiteTestSummary[];
  readonly onNav: (nav: ReportNavState) => void;
}) {
  const { data, nav, bucketId, runId, onNav } = props;
  const frames = useMemo(() => flattenFrames(data.steps), [data.steps]);
  const selectedIdx =
    resolveSelectedFrameIndex(frames, data.steps, nav) ??
    playheadFrameIndex(null, frames.length);
  const frame =
    selectedIdx >= 0 && selectedIdx < frames.length
      ? (frames[selectedIdx] ?? null)
      : null;

  const topology = useTopology(bucketId, runId, data.meta.testId);
  const nodes = useMemo(
    () => resolveNodeList({ topology, actorIds: data.meta.actorIds }),
    [topology, data.meta.actorIds]
  );
  const fallbackNode = defaultNodeId(nodes);
  const nodeId = nav.node ?? fallbackNode;
  const node = nodes.find((n) => n.id === nodeId) ?? null;
  const views = viewsForNode(node);
  const view = resolveSelectedView(nav.view, views);

  useDefaultNav({ framesLen: frames.length, nav, onNav, fallbackNode, view });

  return (
    <div style={styles.appShell}>
      <ReportHeader
        breadcrumb={
          <NavBreadcrumb
            nav={nav}
            buckets={props.buckets}
            runs={props.runs}
            tests={props.tests}
            onNav={onNav}
          />
        }
        meta={`${data.meta.status} · ${frames.length} frames · seed ${data.meta.seed}`}
      />
      <div style={body}>
        <PlayerStrip
          frames={frames}
          selectedIndex={Math.max(0, selectedIdx)}
          onSelect={(index) => {
            onNav(navigateReport(nav, { frame: index + 1 }));
          }}
        />
        <TabBar
          label="Nodes"
          items={nodes.map((n) => ({ id: n.id, label: n.id }))}
          selectedId={nodeId}
          onSelect={(id) => onNav(navigateReport(nav, { node: id }))}
        />
        <TabBar
          label="Views"
          items={views.map((v) => ({ id: v, label: v }))}
          selectedId={view}
          onSelect={(id) =>
            onNav(navigateReport(nav, { view: id as NodeViewKind }))
          }
        />
        <div style={paneSlot}>
          <SelectedPane
            view={view}
            bucketId={bucketId}
            runId={runId}
            testId={data.meta.testId}
            frame={frame}
            nodeId={nodeId}
            node={node}
          />
        </div>
      </div>
    </div>
  );
}

function SelectedPane(props: {
  readonly view: NodeViewKind | null;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: ReturnType<typeof flattenFrames>[number] | null;
  readonly nodeId: string | null;
  readonly node: ReturnType<typeof resolveNodeList>[number] | null;
}) {
  const loc = {
    bucketId: props.bucketId,
    runId: props.runId,
    testId: props.testId,
    frame: props.frame,
    nodeId: props.nodeId,
  };
  if (props.view === 'html') {
    return <HtmlPane {...loc} node={props.node} />;
  }
  if (props.view === 'sqlite') {
    return <SqlitePane {...loc} />;
  }
  if (props.view === 'events') {
    return <EventsPane {...loc} />;
  }
  return <div style={styles.empty}>No views for this node.</div>;
}

function useTopology(
  bucketId: string,
  runId: string,
  testId: string
): SimulationReportTopology | null {
  const [topology, setTopology] = useState<SimulationReportTopology | null>(
    null
  );
  useEffect(() => {
    let cancelled = false;
    void fetchTestTopology(bucketId, runId, testId).then((topo) => {
      if (!cancelled) setTopology(topo);
    });
    return () => {
      cancelled = true;
    };
  }, [bucketId, runId, testId]);
  return topology;
}

function useDefaultNav(args: {
  readonly framesLen: number;
  readonly nav: ReportNavState;
  readonly onNav: (nav: ReportNavState) => void;
  readonly fallbackNode: string | null;
  readonly view: NodeViewKind | null;
}): void {
  const { framesLen, nav, onNav, fallbackNode, view } = args;
  useEffect(() => {
    if (nav.frame != null || framesLen === 0) return;
    onNav(navigateReport(nav, { frame: 1 }, 'replace'));
  }, [framesLen, nav, onNav]);

  useEffect(() => {
    if (nav.node != null || fallbackNode == null) return;
    onNav(navigateReport(nav, { node: fallbackNode }, 'replace'));
  }, [fallbackNode, nav, onNav]);

  useEffect(() => {
    if (view == null || nav.view === view) return;
    onNav(navigateReport(nav, { view }, 'replace'));
  }, [view, nav, onNav]);
}

const body: CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'auto auto auto minmax(0, 1fr)',
  minHeight: 0,
  minWidth: 0,
};

const paneSlot: CSSProperties = {
  minHeight: 0,
  minWidth: 0,
  overflow: 'hidden',
  background: t.bg,
};
