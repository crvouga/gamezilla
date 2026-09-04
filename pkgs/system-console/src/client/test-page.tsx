import { Box, Text } from '@pkgs/ui';
import { useEffect, useMemo, useState } from 'react';
import {
  chromeKindForNodeKind,
  instancesForKind,
  sqliteNodeIdForApi,
} from '../shared/debugger-nodes';
import type { DebuggerViewId } from '../shared/debugger-views';
import { coerceDebuggerView, viewsForKind } from '../shared/debugger-views';
import type { SystemChromeKind } from '../shared/system-node';
import type {
  RunSummary,
  SimulationReportData,
  SimulationReportTopology,
  SuiteTestSummary,
} from '../types';
import type { BucketInfo, ReportApiClient } from './api-client';
import { DebuggerShell } from './debugger/debugger-shell';
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
  type TopologyNodeInfo,
} from './node-views';
import { ReportHeader } from './report-header';
import type { ReportNavState } from './router';
import { navigateReport } from './router';
import { SqlitePane } from './sqlite-pane';
import { appShellSx, emptySx, paneSx } from './tokens';

export function TestPage(props: {
  readonly data: SimulationReportData;
  readonly nav: ReportNavState;
  readonly bucketId: string;
  readonly runId: string;
  readonly buckets: readonly BucketInfo[];
  readonly runs: readonly RunSummary[];
  readonly tests: readonly SuiteTestSummary[];
  readonly onNav: (nav: ReportNavState) => void;
  readonly api: ReportApiClient;
}) {
  const { data, nav, bucketId, runId, onNav, api } = props;
  const frames = useMemo(() => flattenFrames(data.steps), [data.steps]);
  const selectedIdx =
    resolveSelectedFrameIndex(frames, data.steps, nav) ??
    playheadFrameIndex(null, frames.length);
  const frame =
    selectedIdx >= 0 && selectedIdx < frames.length
      ? (frames[selectedIdx] ?? null)
      : null;

  const topology = useTopology(api, bucketId, runId, data.meta.testId);
  const nodes = useMemo(
    () => resolveNodeList({ topology, actorIds: data.meta.actorIds }),
    [topology, data.meta.actorIds]
  );
  const chrome = resolveReportChrome(nodes, nav.node);
  const views = viewsForKind(chrome.kind, {
    hasCommands: false,
    hasTopics: false,
  });
  const view = coerceDebuggerView(chrome.kind, nav.view ?? undefined);

  useDefaultNav({
    framesLen: frames.length,
    nav,
    onNav,
    fallbackNode: chrome.nodeId,
    view,
  });

  return (
    <Box sx={appShellSx}>
      <DebuggerShell
        header={
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
        }
        frames={frames}
        selectedFrameIndex={Math.max(0, selectedIdx)}
        onSelectFrame={(index) => {
          onNav(navigateReport(nav, { frame: index + 1 }));
        }}
        kind={chrome.kind}
        onKindChange={(kind) => {
          const next = firstNodeId(nodes, kind);
          onNav(
            navigateReport(nav, {
              node: next,
              view: coerceDebuggerView(kind, view),
            })
          );
        }}
        instances={chrome.instances}
        instanceId={chrome.nodeId}
        onInstanceChange={(id) => onNav(navigateReport(nav, { node: id }))}
        views={views}
        view={view}
        onViewChange={(next) => onNav(navigateReport(nav, { view: next }))}
      >
        <SelectedPane
          view={view}
          api={api}
          bucketId={bucketId}
          runId={runId}
          testId={data.meta.testId}
          frame={frame}
          nodeId={paneNodeId(chrome, view, nodes)}
          node={nodes.find((n) => n.id === chrome.nodeId) ?? null}
        />
      </DebuggerShell>
    </Box>
  );
}

function resolveReportChrome(
  nodes: readonly TopologyNodeInfo[],
  navNode: string | null
): {
  readonly kind: SystemChromeKind;
  readonly nodeId: string | null;
  readonly instances: readonly TopologyNodeInfo[];
} {
  const fallback = defaultNodeId(nodes);
  const selected = navNode ?? fallback;
  const selectedNode = nodes.find((n) => n.id === selected);
  const kind = chromeKindForNodeKind(selectedNode?.kind ?? 'client');
  const instances = instancesForKind(nodes, kind);
  const nodeId =
    instances.find((n) => n.id === selected)?.id ??
    instances[0]?.id ??
    firstNodeId(nodes, kind);
  return { kind, nodeId, instances };
}

function firstNodeId(
  nodes: readonly TopologyNodeInfo[],
  kind: SystemChromeKind
): string | null {
  const instances = instancesForKind(nodes, kind);
  if (instances[0] !== undefined) return instances[0].id;
  if (kind === 'api') return sqliteNodeIdForApi(nodes);
  return kind;
}

function paneNodeId(
  chrome: {
    readonly kind: SystemChromeKind;
    readonly nodeId: string | null;
  },
  view: DebuggerViewId,
  nodes: readonly TopologyNodeInfo[]
): string | null {
  if (view === 'db' && chrome.kind === 'api') {
    return sqliteNodeIdForApi(nodes);
  }
  return chrome.nodeId;
}

function SelectedPane(props: {
  readonly view: DebuggerViewId | null;
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: ReturnType<typeof flattenFrames>[number] | null;
  readonly nodeId: string | null;
  readonly node: TopologyNodeInfo | null;
}) {
  const loc = {
    bucketId: props.bucketId,
    runId: props.runId,
    testId: props.testId,
    frame: props.frame,
    nodeId: props.nodeId,
  };
  if (props.view === 'ui') {
    return <HtmlPane {...loc} api={props.api} node={props.node} />;
  }
  if (props.view === 'db') {
    return <SqlitePane {...loc} />;
  }
  if (props.view === 'events') {
    return <EventsPane {...loc} api={props.api} />;
  }
  return (
    <Box sx={paneSx}>
      <Text sx={emptySx}>No views for this node.</Text>
    </Box>
  );
}

function useTopology(
  api: ReportApiClient,
  bucketId: string,
  runId: string,
  testId: string
): SimulationReportTopology | null {
  const [topology, setTopology] = useState<SimulationReportTopology | null>(
    null
  );
  useEffect(() => {
    let cancelled = false;
    void api.fetchTestTopology(bucketId, runId, testId).then((topo) => {
      if (!cancelled) setTopology(topo);
    });
    return () => {
      cancelled = true;
    };
  }, [api, bucketId, runId, testId]);
  return topology;
}

function useDefaultNav(args: {
  readonly framesLen: number;
  readonly nav: ReportNavState;
  readonly onNav: (nav: ReportNavState) => void;
  readonly fallbackNode: string | null;
  readonly view: DebuggerViewId | null;
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
