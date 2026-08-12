import { useEffect, useMemo, useRef, useState } from 'react';

import type { SimulationReportData } from '../types';
import { testFrameUrl } from './api-client';
import {
  type FlatFrame,
  firstFrameForStep,
  flattenFrames,
  formatMs,
  resolveFrameIndex,
} from './frames';
import { PlaybackControls } from './playback-controls';
import { StepDetail, StepList } from './player-panels';
import type { PlayMode, PlaySpeed, ReportNavState } from './router';
import { clearPlayerNav, navigateReport } from './router';

export function TestPlayer(props: {
  readonly data: SimulationReportData;
  readonly nav: ReportNavState;
  readonly bucketId: string;
  readonly runId: string;
  readonly onNav: (nav: ReportNavState) => void;
}) {
  const { data, nav, bucketId, runId, onNav } = props;
  const testId = data.meta.testId;
  const frames = useMemo(() => flattenFrames(data.steps), [data.steps]);
  const activeFrameIdx = resolveFrameIndex(frames, data.steps, nav);
  const [hoverFrameIdx, setHoverFrameIdx] = useState<number | null>(null);
  const previewIdx =
    !nav.play && hoverFrameIdx != null ? hoverFrameIdx : activeFrameIdx;
  const previewFrame =
    previewIdx >= 0 && previewIdx < frames.length ? frames[previewIdx] : null;
  const activeStep =
    activeFrameIdx >= 0 ? frames[activeFrameIdx]?.step : data.steps[0];

  usePlayback({ nav, frames, activeFrameIdx, testId, onNav });

  const actions = usePlayerActions({
    nav,
    onNav,
    testId,
    frames,
    data,
    activeFrameIdx,
  });

  return (
    <div className="test-page">
      <PlayerHeader
        data={data}
        testId={testId}
        frameCount={frames.length}
        onBack={() => onNav(navigateReport(nav, clearPlayerNav()))}
      />
      <div className="player-layout">
        <StepList
          steps={data.steps}
          activeStepIndex={activeStep?.index}
          onSelectStep={actions.selectStep}
        />
        <StepDetail
          step={activeStep}
          previewSrc={
            previewFrame
              ? testFrameUrl(bucketId, runId, testId, previewFrame.file)
              : null
          }
        />
      </div>
      <PlaybackControls
        nav={nav}
        frames={frames}
        previewIdx={previewIdx}
        previewDurationMs={previewFrame?.durationMs}
        onTogglePlay={() => actions.setPlay(!nav.play)}
        onMode={actions.setMode}
        onSpeed={actions.setSpeed}
      />
      <Filmstrip
        frames={frames}
        activeFrameIdx={activeFrameIdx}
        hoverFrameIdx={nav.play ? null : hoverFrameIdx}
        {...(nav.play
          ? {}
          : {
              onHover: (idx: number | null) => {
                setHoverFrameIdx(idx);
              },
            })}
        onSelect={(i) => actions.selectFrame(i, 'push')}
      />
    </div>
  );
}

function PlayerHeader(props: {
  readonly data: SimulationReportData;
  readonly testId: string;
  readonly frameCount: number;
  readonly onBack: () => void;
}) {
  const { data, testId, frameCount, onBack } = props;
  return (
    <header className="test-header">
      <button type="button" className="back" onClick={onBack}>
        ← Run
      </button>
      <h1>Simulation report</h1>
      <span className={`badge ${data.meta.status}`}>
        {data.meta.status.toUpperCase()}
      </span>
      <span className="meta">
        {testId} · seed {data.meta.seed} · {data.meta.ui} · {data.steps.length}{' '}
        steps · {frameCount} frames · {formatMs(data.meta.durationMs)}
      </span>
    </header>
  );
}

function usePlayerActions(args: {
  readonly nav: ReportNavState;
  readonly onNav: (nav: ReportNavState) => void;
  readonly testId: string;
  readonly frames: readonly FlatFrame[];
  readonly data: SimulationReportData;
  readonly activeFrameIdx: number;
}) {
  const { nav, onNav, testId, frames, data, activeFrameIdx } = args;

  const selectFrame = (frameIdx: number, historyMode: 'push' | 'replace') => {
    if (frameIdx < 0 || frameIdx >= frames.length) return;
    const frame = frames[frameIdx]!;
    onNav(
      navigateReport(
        nav,
        {
          testId,
          frame: frameIdx + 1,
          step: frame.step.index,
          play: false,
        },
        historyMode
      )
    );
  };

  const selectStep = (stepIndex: number) => {
    const fi = firstFrameForStep(frames, stepIndex);
    if (fi >= 0) {
      selectFrame(fi, 'push');
      return;
    }
    const step = data.steps[stepIndex];
    if (!step) return;
    onNav(
      navigateReport(
        nav,
        { testId, step: step.index, frame: null, play: false },
        'push'
      )
    );
  };

  const setPlay = (play: boolean) => {
    let frameIdx = activeFrameIdx;
    if (play && (frameIdx < 0 || frameIdx >= frames.length - 1)) frameIdx = 0;
    const frame = frames[frameIdx];
    onNav(
      navigateReport(
        nav,
        {
          testId,
          play,
          ...(frame ? { frame: frameIdx + 1, step: frame.step.index } : {}),
        },
        'replace'
      )
    );
  };

  return {
    selectFrame,
    selectStep,
    setPlay,
    setMode: (mode: PlayMode) => {
      onNav(navigateReport(nav, { mode, play: false }, 'replace'));
    },
    setSpeed: (speed: PlaySpeed) => {
      onNav(navigateReport(nav, { speed, play: false }, 'replace'));
    },
  };
}

function Filmstrip(props: {
  readonly frames: readonly FlatFrame[];
  readonly activeFrameIdx: number;
  readonly hoverFrameIdx: number | null;
  readonly onHover?: (idx: number | null) => void;
  readonly onSelect: (idx: number) => void;
}) {
  const { frames, activeFrameIdx, hoverFrameIdx, onHover, onSelect } = props;
  const activeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeRef.current?.scrollIntoView({
      behavior: 'smooth',
      inline: 'center',
      block: 'nearest',
    });
  }, [activeFrameIdx]);

  return (
    <div className="filmstrip" aria-label="Frames">
      {frames.map((frame, i) => {
        const active = i === activeFrameIdx;
        const hover = hoverFrameIdx === i;
        return (
          <button
            key={`${frame.file}-${i}`}
            ref={active ? activeRef : undefined}
            type="button"
            className={`frame-thumb${active ? ' active' : ''}${
              hover ? ' hover' : ''
            }${frame.step.status === 'failed' ? ' failed' : ''}`}
            title={`${frame.step.title} · ${formatMs(frame.durationMs)}`}
            onMouseEnter={() => onHover?.(i)}
            onMouseLeave={() => onHover?.(null)}
            onClick={() => onSelect(i)}
          >
            <span className="idx">{i + 1}</span>
            <span>s{frame.step.index}</span>
          </button>
        );
      })}
    </div>
  );
}

function usePlayback(args: {
  readonly nav: ReportNavState;
  readonly frames: readonly FlatFrame[];
  readonly activeFrameIdx: number;
  readonly testId: string;
  readonly onNav: (nav: ReportNavState) => void;
}) {
  const { nav, frames, activeFrameIdx, testId, onNav } = args;
  const navRef = useRef(nav);
  navRef.current = nav;

  useEffect(() => {
    if (!nav.play || frames.length === 0) return;
    if (activeFrameIdx < 0 || activeFrameIdx >= frames.length) return;

    const frame = frames[activeFrameIdx]!;
    const base =
      nav.mode === 'fixed'
        ? 250
        : Math.max(40, frame.durationMs > 0 ? frame.durationMs : 120);
    const delayMs = base / nav.speed;

    const timer = window.setTimeout(() => {
      const current = navRef.current;
      if (!current.play) return;
      const nextIdx = activeFrameIdx + 1;
      if (nextIdx >= frames.length) {
        onNav(navigateReport(current, { play: false }, 'replace'));
        return;
      }
      const nextFrame = frames[nextIdx]!;
      onNav(
        navigateReport(
          current,
          {
            testId,
            frame: nextIdx + 1,
            step: nextFrame.step.index,
            play: true,
          },
          'replace'
        )
      );
    }, delayMs);

    return () => window.clearTimeout(timer);
  }, [nav.play, nav.mode, nav.speed, activeFrameIdx, frames, testId, onNav]);
}
