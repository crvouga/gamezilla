import type { ReactNode } from 'react';

import type {
  RunSummary,
  SimulationReportData,
  SuiteTestSummary,
} from '../types';
import type { BucketInfo } from './api-client';
import { CopyLlmPromptButton } from './copy-llm-prompt-button';
import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import { NavBreadcrumb } from './nav-breadcrumb';
import { ReportHeader } from './report-header';
import type { ReportNavState } from './router';
import { badgeStyle } from './theme';

export function PlayerChrome(props: {
  readonly data: SimulationReportData;
  readonly bucketId: string;
  readonly runId: string;
  readonly nav: ReportNavState;
  readonly buckets: readonly BucketInfo[];
  readonly runs: readonly RunSummary[];
  readonly tests: readonly SuiteTestSummary[];
  readonly frames: readonly FlatFrame[];
  readonly selectedFrameIdx: number | null;
  readonly playheadIdx: number;
  readonly previewIdx: number;
  readonly registerCopyAction: (run: () => void) => void;
  readonly onNav: (nav: ReportNavState) => void;
  readonly children: ReactNode;
}) {
  const {
    data,
    bucketId,
    runId,
    nav,
    buckets,
    runs,
    tests,
    frames,
    selectedFrameIdx,
    playheadIdx,
    previewIdx,
    registerCopyAction,
    onNav,
    children,
  } = props;
  return (
    <>
      <ReportHeader
        breadcrumb={
          <NavBreadcrumb
            nav={nav}
            buckets={buckets}
            runs={runs}
            tests={tests}
            onNav={onNav}
          />
        }
        badge={
          <span style={badgeStyle(data.meta.status)}>
            {data.meta.status.toUpperCase()}
          </span>
        }
        meta={`seed ${data.meta.seed} · ${frames.length}f · ${formatMs(data.meta.durationMs)}`}
        end={
          <CopyLlmPromptButton
            data={data}
            bucketId={bucketId}
            runId={runId}
            selectedFrameIdx={selectedFrameIdx}
            playheadIdx={playheadIdx}
            previewIdx={previewIdx}
            registerCopyAction={registerCopyAction}
          />
        }
      />
      {children}
    </>
  );
}
