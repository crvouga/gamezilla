import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { SimulationReportData } from '../types';
import { testFrameUrl } from './api-client';
import { buildPlayerCommands } from './commands/player-commands';
import { useRegisterCommands } from './commands/registry';
import { FrameRail, LONG_HOLD_PULSE_MS } from './frame-rail';
import {
  type FlatFrame,
  flattenFrames,
  formatMs,
  resolveFrameIndex,
} from './frames';
import { maxFrameDuration } from './heat';
import { playbackHoldMs } from './playback-hold';
import { PlayerStage } from './player-stage';
import type { PlayMode, PlaySpeed, ReportNavState } from './router';
import { clearPlayerNav, navigateReport } from './router';
import { Transport } from './transport';
import { useHoldCountdown } from './use-hold-countdown';

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
  const maxDurationMs = useMemo(() => maxFrameDuration(frames), [frames]);
  const activeFrameIdx = resolveFrameIndex(frames, data.steps, nav);
  const [hoverFrameIdx, setHoverFrameIdx] = useState<number | null>(null);
  const previewIdx =
    !nav.play && hoverFrameIdx != null ? hoverFrameIdx : activeFrameIdx;
  const previewFrame =
    previewIdx >= 0 && previewIdx < frames.length
      ? (frames[previewIdx] ?? null)
      : null;
  const holdRemainingMs = useHoldCountdown({
    nav,
    activeFrameIdx,
    previewFrame,
    minHoldMs: LONG_HOLD_PULSE_MS,
  });

  usePlayback({ nav, frames, activeFrameIdx, testId, onNav });
  const actions = usePlayerActions({
    nav,
    onNav,
    testId,
    frames,
    activeFrameIdx,
  });
  usePlayerCommands({ nav, frames, previewIdx, actions, onNav });

  const onHover = useCallback(
    (idx: number | null) => {
      if (!nav.play) setHoverFrameIdx(idx);
    },
    [nav.play]
  );

  return (
    <div className="test-page">
      <PlayerHeader
        data={data}
        testId={testId}
        frameCount={frames.length}
        onBack={() => onNav(navigateReport(nav, clearPlayerNav()))}
        transport={
          <Transport
            compact
            nav={nav}
            frames={frames}
            previewIdx={previewIdx}
            previewDurationMs={previewFrame?.durationMs}
            onTogglePlay={() => actions.setPlay(!nav.play)}
            onPrev={() =>
              actions.selectFrame(Math.max(0, previewIdx - 1), 'push')
            }
            onNext={() =>
              actions.selectFrame(
                Math.min(frames.length - 1, previewIdx + 1),
                'push'
              )
            }
            onMode={actions.setMode}
            onSpeed={actions.setSpeed}
          />
        }
      />
      <div className="player-layout">
        <FrameRail
          frames={frames}
          previewIdx={previewIdx}
          maxDurationMs={maxDurationMs}
          holdRemainingMs={holdRemainingMs}
          onHover={onHover}
          onSelect={(i) => actions.selectFrame(i, 'push')}
        />
        <PlayerStage
          previewFrame={previewFrame ?? null}
          previewSrc={
            previewFrame
              ? testFrameUrl(bucketId, runId, testId, previewFrame.file)
              : null
          }
        />
      </div>
    </div>
  );
}

function PlayerHeader(props: {
  readonly data: SimulationReportData;
  readonly testId: string;
  readonly frameCount: number;
  readonly onBack: () => void;
  readonly transport: ReactNode;
}) {
  const { data, testId, frameCount, onBack, transport } = props;
  return (
    <header className="test-header">
      <button type="button" className="back" onClick={onBack}>
        ← Run
      </button>
      <h1>report</h1>
      <span className={`badge ${data.meta.status}`}>
        {data.meta.status.toUpperCase()}
      </span>
      <span className="meta">
        {testId} · seed {data.meta.seed} · {frameCount}f ·{' '}
        {formatMs(data.meta.durationMs)}
      </span>
      <div className="header-transport">{transport}</div>
      <span className="kbd-hint">⌘K</span>
    </header>
  );
}

type PlayerActions = {
  readonly selectFrame: (
    frameIdx: number,
    historyMode: 'push' | 'replace'
  ) => void;
  readonly setPlay: (play: boolean) => void;
  readonly setMode: (mode: PlayMode) => void;
  readonly setSpeed: (speed: PlaySpeed) => void;
};

function usePlayerActions(args: {
  readonly nav: ReportNavState;
  readonly onNav: (nav: ReportNavState) => void;
  readonly testId: string;
  readonly frames: readonly FlatFrame[];
  readonly activeFrameIdx: number;
}): PlayerActions {
  const { nav, onNav, testId, frames, activeFrameIdx } = args;

  const selectFrame = useCallback(
    (frameIdx: number, historyMode: 'push' | 'replace') => {
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
    },
    [frames, nav, onNav, testId]
  );

  const setPlay = useCallback(
    (play: boolean) => {
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
    },
    [activeFrameIdx, frames, nav, onNav, testId]
  );

  const setMode = useCallback(
    (mode: PlayMode) => {
      onNav(navigateReport(nav, { mode, play: false }, 'replace'));
    },
    [nav, onNav]
  );

  const setSpeed = useCallback(
    (speed: PlaySpeed) => {
      onNav(navigateReport(nav, { speed, play: false }, 'replace'));
    },
    [nav, onNav]
  );

  return useMemo(
    () => ({ selectFrame, setPlay, setMode, setSpeed }),
    [selectFrame, setPlay, setMode, setSpeed]
  );
}

function usePlayerCommands(args: {
  readonly nav: ReportNavState;
  readonly frames: readonly FlatFrame[];
  readonly previewIdx: number;
  readonly actions: PlayerActions;
  readonly onNav: (nav: ReportNavState) => void;
}) {
  const { nav, frames, previewIdx, actions, onNav } = args;
  const commands = useMemo(
    () => buildPlayerCommands({ nav, frames, previewIdx, actions, onNav }),
    [nav, frames, previewIdx, actions, onNav]
  );
  useRegisterCommands(commands);
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
    const delayMs = playbackHoldMs({
      frame,
      mode: nav.mode,
      speed: nav.speed,
    });

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
