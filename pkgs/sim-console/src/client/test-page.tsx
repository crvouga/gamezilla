import { Box } from '@pkgs/ui';
import { useEffect, useMemo, useState } from 'react';

import {
  findNodeForInstance,
  instanceParamForNodeId,
  instancesForKind,
  sqliteNodeIdForApi,
} from '../shared/debugger-nodes';
import {
  coerceDebuggerView,
  type DebuggerViewId,
  viewsForKind,
} from '../shared/debugger-views';
import type { SimConsolePorts } from '../shared/ports';
import type { SimChromeKind } from '../shared/sim-node';
import type { SimulationReportData, SimulationReportTopology } from '../types';
import type { ReportApiClient } from './api-client';
import { DebuggerShell } from './debugger/debugger-shell';
import type { DebuggerChromeNav } from './debugger-chrome';
import {
  flattenFrames,
  playheadFrameIndex,
  resolveSelectedFrameIndex,
} from './frames';
import {
  defaultNodeId,
  resolveNodeList,
  type TopologyNodeInfo,
} from './node-views';
import { ReportHeader } from './report-header';
import type { ReportNavState } from './router';
import { navigateReport } from './router';
import { ReportKindPane } from './test-page-panes';
import { appShellSx } from './tokens';
import { useReportReplay } from './use-report-replay';

export function TestPage(props: {
  readonly data: SimulationReportData;
  readonly nav: ReportNavState;
  readonly bucketId: string;
  readonly runId: string;
  readonly onNav: (nav: ReportNavState) => void;
  readonly api: ReportApiClient;
  readonly chrome: DebuggerChromeNav;
  readonly ports: SimConsolePorts;
}) {
  const { data, nav, bucketId, runId, onNav, api, chrome, ports } = props;
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
  const instances = instancesForKind(nodes, chrome.kind);
  const selected =
    findNodeForInstance(nodes, chrome.kind, chrome.instance) ??
    instances[0] ??
    null;
  const views = viewsForKind(chrome.kind, {
    hasCommands: false,
    hasTopics: false,
  });
  const view = coerceDebuggerView(chrome.kind, chrome.view);
  const replay = useReportReplay({
    ports,
    frame,
    api,
    bucketId,
    runId,
    testId: data.meta.testId,
  });

  useDefaultNav({
    framesLen: frames.length,
    nav,
    onNav,
    fallbackNode: selected?.id ?? defaultNodeId(nodes),
    view,
  });

  return (
    <Box sx={appShellSx}>
      <ReportDebuggerShell
        data={data}
        nav={nav}
        frames={frames}
        selectedIdx={selectedIdx}
        view={view}
        views={views}
        instances={instances}
        selected={selected}
        nodes={nodes}
        chrome={chrome}
        onNav={onNav}
        api={api}
        bucketId={bucketId}
        runId={runId}
        frame={frame}
        ports={ports}
        replay={replay}
      />
    </Box>
  );
}

type ReportDebuggerShellProps = {
  readonly data: SimulationReportData;
  readonly nav: ReportNavState;
  readonly frames: ReturnType<typeof flattenFrames>;
  readonly selectedIdx: number;
  readonly view: DebuggerViewId;
  readonly views: readonly DebuggerViewId[];
  readonly instances: readonly TopologyNodeInfo[];
  readonly selected: TopologyNodeInfo | null;
  readonly nodes: readonly TopologyNodeInfo[];
  readonly chrome: DebuggerChromeNav;
  readonly onNav: (nav: ReportNavState) => void;
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly frame: ReturnType<typeof flattenFrames>[number] | null;
  readonly ports: SimConsolePorts;
  readonly replay: ReturnType<typeof useReportReplay>;
};

function ReportDebuggerShell(props: ReportDebuggerShellProps) {
  const { nav, chrome, view, nodes, onNav } = props;
  return (
    <DebuggerShell
      header={<ReportTestHeader {...props} />}
      frames={props.frames}
      selectedFrameIndex={Math.max(0, props.selectedIdx)}
      onSelectFrame={(index) => {
        onNav(navigateReport(nav, { frame: index + 1 }));
      }}
      kind={chrome.kind}
      onKindChange={(kind) => {
        const next = findNodeForInstance(nodes, kind, null);
        patchChrome({ nodes, chrome, kind, view });
        onNav(
          navigateReport(nav, {
            node: next?.id ?? null,
            view: coerceDebuggerView(kind, view),
          })
        );
      }}
      instances={props.instances}
      instanceId={props.selected?.id ?? null}
      onInstanceChange={(id) => {
        chrome.onInstanceChange(instanceParamForNodeId(id));
        onNav(navigateReport(nav, { node: id }));
      }}
      views={props.views}
      view={view}
      onViewChange={(next) => {
        chrome.onViewChange(next);
        onNav(navigateReport(nav, { view: next }));
      }}
    >
      <ReportKindPane
        ports={props.ports}
        replay={props.replay}
        kind={chrome.kind}
        view={view}
        instances={props.instances}
        selected={props.selected}
        nodeId={paneNodeId({
          kind: chrome.kind,
          view,
          nodeId: props.selected?.id ?? null,
          nodes,
        })}
        api={props.api}
        bucketId={props.bucketId}
        runId={props.runId}
        testId={props.data.meta.testId}
        frame={props.frame}
      />
    </DebuggerShell>
  );
}

function ReportTestHeader(props: ReportDebuggerShellProps) {
  return (
    <ReportHeader
      meta={`${props.data.meta.status} · ${props.frames.length} frames · seed ${props.data.meta.seed}`}
    />
  );
}

function patchChrome(args: {
  readonly nodes: readonly TopologyNodeInfo[];
  readonly chrome: DebuggerChromeNav;
  readonly kind: SimChromeKind;
  readonly view: DebuggerViewId;
}): void {
  const next = findNodeForInstance(args.nodes, args.kind, null);
  args.chrome.onKindChange(args.kind);
  args.chrome.onInstanceChange(
    next !== undefined ? instanceParamForNodeId(next.id) : ''
  );
  args.chrome.onViewChange(coerceDebuggerView(args.kind, args.view));
}

function paneNodeId(args: {
  readonly kind: SimChromeKind;
  readonly view: DebuggerViewId;
  readonly nodeId: string | null;
  readonly nodes: readonly TopologyNodeInfo[];
}): string | null {
  if (args.view === 'db' && args.kind === 'api') {
    return sqliteNodeIdForApi(args.nodes);
  }
  return args.nodeId;
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
