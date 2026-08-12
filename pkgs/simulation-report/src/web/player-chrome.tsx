import type { ReactNode } from 'react';

import type { SimulationReportData } from '../types';
import { CopyLlmPromptButton } from './copy-llm-prompt-button';
import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import { ReportHeader } from './report-header';
import { badgeStyle } from './theme';

export function PlayerChrome(props: {
  readonly data: SimulationReportData;
  readonly testId: string;
  readonly bucketId: string;
  readonly runId: string;
  readonly frames: readonly FlatFrame[];
  readonly selectedFrameIdx: number | null;
  readonly playheadIdx: number;
  readonly previewIdx: number;
  readonly registerCopyAction: (run: () => void) => void;
  readonly onBack: () => void;
  readonly children: ReactNode;
}) {
  const {
    data,
    testId,
    bucketId,
    runId,
    frames,
    selectedFrameIdx,
    playheadIdx,
    previewIdx,
    registerCopyAction,
    onBack,
    children,
  } = props;
  return (
    <>
      <ReportHeader
        back={{ label: '← Run', onClick: onBack }}
        title={testId}
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
