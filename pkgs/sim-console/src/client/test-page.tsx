import {
  BackIconButton,
  ChevronLeftIcon,
  ChevronRightIcon,
  IconButton,
} from '@pkgs/ui';
import { createEffect, createMemo, createSignal, onCleanup } from 'solid-js';

import {
  findNodeForInstance,
  instancesForKind,
} from '../shared/debugger-nodes';
import type { DebuggerViewId } from '../shared/debugger-views';
import type {
  SimulationReportData,
  SimulationReportTopology,
  SuiteTestSummary,
} from '../types';
import type { ReportApiClient } from './api-client';
import { DebuggerShell } from './debugger/debugger-shell';
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
  readonly onNav: (nav: ReportNavState, mode?: 'push' | 'replace') => void;
  readonly api: ReportApiClient;
}) {
  const frames = createMemo(() => flattenFrames(props.data.steps));
  const selectedIdx = () =>
    resolveSelectedFrameIndex(frames(), props.data.steps, props.nav) ??
    playheadFrameIndex(null, frames().length);
  const frame = () => {
    const idx = selectedIdx();
    return idx >= 0 && idx < frames().length ? (frames()[idx] ?? null) : null;
  };

  const topology = useTopology({
    api: () => props.api,
    bucketId: () => props.bucketId,
    runId: () => props.runId,
    testId: () => props.data.meta.testId,
    frames,
  });
  const nodes = createMemo(() =>
    resolveNodeList({
      topology: topology(),
      actorIds: props.data.meta.actorIds,
    })
  );
  const instances = createMemo(() => instancesForKind(nodes(), 'client'));
  const selected = createMemo(
    () =>
      findNodeForInstance(nodes(), 'client', props.nav.node) ??
      instances()[0] ??
      null
  );
  const reportView = createMemo((): DebuggerViewId => props.nav.view ?? 'ui');

  useDefaultNav({
    framesLen: () => frames().length,
    nav: () => props.nav,
    onNav: (nav, mode) => props.onNav(nav, mode),
    fallbackNode: () => selected()?.id ?? defaultNodeId(nodes()),
    view: reportView,
  });

  return (
    <div class="box" style={appShellSx}>
      <ReportDebuggerShell
        data={props.data}
        nav={props.nav}
        frames={frames()}
        selectedIdx={selectedIdx()}
        instances={instances()}
        selected={selected()}
        tests={props.tests}
        onNav={props.onNav}
        api={props.api}
        bucketId={props.bucketId}
        runId={props.runId}
        frame={frame()}
        reportView={reportView()}
      />
    </div>
  );
}

type ReportDebuggerShellProps = {
  readonly data: SimulationReportData;
  readonly nav: ReportNavState;
  readonly frames: ReturnType<typeof flattenFrames>;
  readonly selectedIdx: number;
  readonly instances: readonly TopologyNodeInfo[];
  readonly selected: TopologyNodeInfo | null;
  readonly tests: readonly SuiteTestSummary[];
  readonly onNav: (nav: ReportNavState, mode?: 'push' | 'replace') => void;
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly frame: ReturnType<typeof flattenFrames>[number] | null;
  readonly reportView: DebuggerViewId;
};

function ReportDebuggerShell(props: ReportDebuggerShellProps) {
  const onSelectFrame = (index: number) => {
    props.onNav(navigateReport(props.nav, { frame: index + 1 }), 'replace');
  };
  return (
    <DebuggerShell
      header={<ReportTestHeader {...props} />}
      kindTabs={[]}
      frames={props.frames}
      selectedFrameIndex={Math.max(0, props.selectedIdx)}
      onSelectFrame={onSelectFrame}
      kind="client"
      onKindChange={() => undefined}
      instances={props.instances}
      instanceId={props.selected?.id ?? null}
      onInstanceChange={(id) => {
        props.onNav(navigateReport(props.nav, { node: id }));
      }}
      views={[props.reportView]}
      view={props.reportView}
      onViewChange={(view) => {
        props.onNav(navigateReport(props.nav, { view }));
      }}
    >
      <ReportKindPane
        kind="client"
        view={props.reportView}
        instances={props.instances}
        selected={props.selected}
        nodeId={props.selected?.id ?? null}
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
  const neighbor = createMemo(() =>
    resolveTestNeighbor(props.tests, props.data.meta.testId)
  );
  return (
    <ReportHeader
      leading={
        <BackIconButton
          size={36}
          onClick={() =>
            props.onNav(navigateReport(props.nav, clearPlayerNav()))
          }
        />
      }
      title={
        <h2 class="text textNavigationTitle line-clamp-1" style={testTitleSx}>
          {props.data.meta.testId}
        </h2>
      }
      meta={`${props.data.meta.status} · ${props.frames.length} frames · seed ${props.data.meta.seed}`}
      end={
        <TestNeighborButtons
          neighbor={neighbor()}
          onPrev={() =>
            goToNeighborTest({
              nav: props.nav,
              onNav: props.onNav,
              testId: neighbor().prev,
            })
          }
          onNext={() =>
            goToNeighborTest({
              nav: props.nav,
              onNav: props.onNav,
              testId: neighbor().next,
            })
          }
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
        onClick={props.onPrev}
        background="surface"
      >
        <ChevronLeftIcon size={18} />
      </IconButton>
      <IconButton
        label="Next test"
        size={36}
        disabled={props.neighbor.next == null}
        onClick={props.onNext}
        background="surface"
      >
        <ChevronRightIcon size={18} />
      </IconButton>
    </>
  );
}

function goToNeighborTest(args: {
  readonly nav: ReportNavState;
  readonly onNav: (nav: ReportNavState, mode?: 'push' | 'replace') => void;
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
  'flex-shrink': 1,
  'min-width': 0,
} as const;

function useTopology(args: {
  readonly api: () => ReportApiClient;
  readonly bucketId: () => string;
  readonly runId: () => string;
  readonly testId: () => string;
  readonly frames: () => ReturnType<typeof flattenFrames>;
}): () => SimulationReportTopology | null {
  const [topology, setTopology] = createSignal<SimulationReportTopology | null>(
    null
  );
  const topologyFile = createMemo(() => {
    const frames = args.frames();
    for (let i = frames.length - 1; i >= 0; i--) {
      const snap = frames[i]?.snapshots.find(
        (s) => s.name === 'topology' && s.media === 'json'
      );
      if (snap) return snap.file;
    }
    return null;
  });

  createEffect(() => {
    const api = args.api();
    const bucketId = args.bucketId();
    const runId = args.runId();
    const testId = args.testId();
    const file = topologyFile();
    let cancelled = false;
    if (file != null) {
      const url = api.testFrameUrl(bucketId, runId, testId, file);
      void api
        .fetch(url)
        .then(async (res) => {
          if (!res.ok) return null;
          return (await res.json()) as SimulationReportTopology;
        })
        .then((topo) => {
          if (!cancelled) setTopology(topo);
        });
      onCleanup(() => {
        cancelled = true;
      });
      return;
    }
    void api.fetchTestTopology(bucketId, runId, testId).then((topo) => {
      if (!cancelled) setTopology(topo);
    });
    onCleanup(() => {
      cancelled = true;
    });
  });
  return topology;
}

function useDefaultNav(args: {
  readonly framesLen: () => number;
  readonly nav: () => ReportNavState;
  readonly onNav: (nav: ReportNavState, mode?: 'push' | 'replace') => void;
  readonly fallbackNode: () => string | null;
  readonly view: () => DebuggerViewId | null;
}): void {
  createEffect(() => {
    const nav = args.nav();
    if (nav.frame != null || args.framesLen() === 0) return;
    args.onNav(navigateReport(nav, { frame: 1 }), 'replace');
  });

  createEffect(() => {
    const nav = args.nav();
    const fallbackNode = args.fallbackNode();
    if (nav.node != null || fallbackNode == null) return;
    args.onNav(navigateReport(nav, { node: fallbackNode }), 'replace');
  });

  createEffect(() => {
    const nav = args.nav();
    const view = args.view();
    if (view == null || nav.view === view) return;
    args.onNav(navigateReport(nav, { view }), 'replace');
  });
}
