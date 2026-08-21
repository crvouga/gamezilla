import {
  BackIconButton,
  Box,
  ChevronLeftIcon,
  ChevronRightIcon,
  IconButton,
  Text,
} from '@pkgs/ui';
import { useEffect, useMemo, useState } from 'react';

import {
  findNodeForInstance,
  instanceParamForNodeId,
  instancesForKind,
  sqliteNodeIdForServer,
} from '../shared/debugger-nodes';
import {
  coerceDebuggerView,
  type DebuggerViewId,
  viewsForKind,
} from '../shared/debugger-views';
import type { SimChromeKind } from '../shared/sim-node';
import type {
  SimulationReportData,
  SimulationReportTopology,
  SuiteTestSummary,
} from '../types';
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
import { clearPlayerNav, navigateReport } from './router';
import { resolveTestNeighbor, type TestNeighbor } from './test-neighbors';
import { ReportKindPane } from './test-page-panes';
import { appShellSx } from './tokens';

export function TestPage(props: {
  readonly data: SimulationReportData;
  readonly tests: readonly SuiteTestSummary[];
  readonly nav: ReportNavState;
  readonly bucketId: string;
  readonly runId: string;
  readonly onNav: (nav: ReportNavState) => void;
  readonly api: ReportApiClient;
  readonly chrome: DebuggerChromeNav;
}) {
  const { data, tests, nav, bucketId, runId, onNav, api, chrome } = props;
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
        tests={tests}
        chrome={chrome}
        onNav={onNav}
        api={api}
        bucketId={bucketId}
        runId={runId}
        frame={frame}
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
  readonly tests: readonly SuiteTestSummary[];
  readonly chrome: DebuggerChromeNav;
  readonly onNav: (nav: ReportNavState) => void;
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly frame: ReturnType<typeof flattenFrames>[number] | null;
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
        frames={props.frames}
        selectedIdx={props.selectedIdx}
      />
    </DebuggerShell>
  );
}

function ReportTestHeader(props: ReportDebuggerShellProps) {
  const { nav, onNav, tests, data, frames } = props;
  const neighbor = resolveTestNeighbor(tests, data.meta.testId);
  return (
    <ReportHeader
      leading={
        <BackIconButton
          size={36}
          onPress={() => onNav(navigateReport(nav, clearPlayerNav()))}
        />
      }
      title={
        <Text
          variant="navigationTitle"
          numberOfLines={1}
          sx={testTitleSx}
          label={data.meta.testId}
        />
      }
      meta={`${data.meta.status} · ${frames.length} frames · seed ${data.meta.seed}`}
      end={
        <TestNeighborButtons
          neighbor={neighbor}
          onPrev={() => goToNeighborTest({ nav, onNav, testId: neighbor.prev })}
          onNext={() => goToNeighborTest({ nav, onNav, testId: neighbor.next })}
        />
      }
    />
  );
}

function TestNeighborButtons(props: {
  readonly neighbor: TestNeighbor;
  readonly onPrev: () => void;
  readonly onNext: () => void;
}) {
  return (
    <>
      <IconButton
        label="Previous test"
        size={36}
        disabled={props.neighbor.prev == null}
        onPress={props.onPrev}
        background="surface"
      >
        <ChevronLeftIcon size={18} />
      </IconButton>
      <IconButton
        label="Next test"
        size={36}
        disabled={props.neighbor.next == null}
        onPress={props.onNext}
        background="surface"
      >
        <ChevronRightIcon size={18} />
      </IconButton>
    </>
  );
}

function goToNeighborTest(args: {
  readonly nav: ReportNavState;
  readonly onNav: (nav: ReportNavState) => void;
  readonly testId: string | null;
}): void {
  if (args.testId == null) return;
  args.onNav(
    navigateReport(
      args.nav,
      clearPlayerNav({
        testId: args.testId,
        node: args.nav.node,
        view: args.nav.view,
      })
    )
  );
}

const testTitleSx = {
  flexShrink: 1,
  minWidth: 0,
} as const;

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
  if (args.view === 'db' && args.kind === 'server') {
    return sqliteNodeIdForServer(args.nodes);
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
