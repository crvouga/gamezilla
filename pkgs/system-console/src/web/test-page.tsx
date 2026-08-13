import { type CSSProperties, useEffect, useMemo, useState } from 'react';

import type {
  RunSummary,
  SimulationReportData,
  SimulationReportTopology,
  SuiteTestSummary,
} from '../types';
import type { BucketInfo } from './api-client';
import { fetchTestTopology } from './api-client';
import {
  flattenFrames,
  playheadFrameIndex,
  resolveSelectedFrameIndex,
} from './frames';
import { HtmlPane } from './html-pane';
import { NavBreadcrumb } from './nav-breadcrumb';
import { ReportHeader } from './report-header';
import type { ReportNavState } from './router';
import { navigateReport } from './router';
import { SqlitePane } from './sqlite-pane';
import { styles, t } from './theme';
import { Timeline } from './timeline';
import { TopologyPane } from './topology-pane';

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

  const [topology, setTopology] = useState<SimulationReportTopology | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    void fetchTestTopology(bucketId, runId, data.meta.testId).then((topo) => {
      if (!cancelled) setTopology(topo);
    });
    return () => {
      cancelled = true;
    };
  }, [bucketId, runId, data.meta.testId]);

  const defaultNode =
    topology?.nodes.find((n) =>
      (topology.definition.kinds[n.kind]?.attributes ?? []).includes('html')
    )?.id ??
    topology?.nodes.find((n) => n.kind === 'api')?.id ??
    data.meta.actorIds[0] ??
    'api';

  const nodeId = nav.node ?? defaultNode;

  useEffect(() => {
    if (nav.frame != null || frames.length === 0) return;
    onNav(navigateReport(nav, { frame: 1 }, 'replace'));
  }, [frames.length, nav, onNav]);

  useEffect(() => {
    if (nav.node != null || defaultNode == null) return;
    onNav(navigateReport(nav, { node: defaultNode }, 'replace'));
  }, [defaultNode, nav, onNav]);

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
        <div style={mainRow}>
          <div style={topoCol}>
            <TopologyPane
              topology={topology}
              selectedNodeId={nodeId}
              onSelectNode={(id) => {
                onNav(navigateReport(nav, { node: id }));
              }}
            />
          </div>
          <div style={htmlCol}>
            <HtmlPane
              bucketId={bucketId}
              runId={runId}
              testId={data.meta.testId}
              frame={frame}
            />
          </div>
        </div>
        <div style={sqlRow}>
          <SqlitePane
            bucketId={bucketId}
            runId={runId}
            testId={data.meta.testId}
            frame={frame}
            nodeId={nodeId}
          />
        </div>
        <Timeline
          frames={frames}
          selectedIndex={Math.max(0, selectedIdx)}
          onSelect={(index) => {
            onNav(navigateReport(nav, { frame: index + 1 }));
          }}
        />
      </div>
    </div>
  );
}

const body: CSSProperties = {
  display: 'grid',
  gridTemplateRows: 'minmax(0, 1fr) minmax(160px, 28%) auto',
  minHeight: 0,
  minWidth: 0,
};

const mainRow: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '260px minmax(0, 1fr)',
  minHeight: 0,
  borderBottom: `1px solid ${t.border}`,
};

const topoCol: CSSProperties = { minHeight: 0, minWidth: 0 };

const htmlCol: CSSProperties = { minHeight: 0, minWidth: 0 };

const sqlRow: CSSProperties = { minHeight: 0, minWidth: 0 };
