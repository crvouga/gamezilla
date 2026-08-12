import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SimulationReportData } from '../types';
import { testFrameUrl } from './api-client';
import { buildPlayerCommands } from './commands/player-commands';
import { useRegisterCommands } from './commands/registry';
import { CopyLlmPromptButton } from './copy-llm-prompt-button';
import { FrameRail, LONG_HOLD_PULSE_MS } from './frame-rail';
import {
  type FlatFrame,
  flattenFrames,
  formatMs,
  playheadFrameIndex,
  resolveSelectedFrameIndex,
} from './frames';
import { playbackHoldMs } from './playback-hold';
import { PlayerStage } from './player-stage';
import { ReportHeader } from './report-header';
import type { PlayMode, PlaySpeed, ReportNavState } from './router';
import { clearPlayerNav, navigateReport } from './router';
import { badgeStyle, styles } from './theme';
import { Transport } from './transport';
import { useHoldCountdown } from './use-hold-countdown';

export function TestPlayer(props: {
  readonly data: SimulationReportData;
  readonly nav: ReportNavState;
  readonly bucketId: string;
  readonly runId: string;
  readonly onNav: (nav: ReportNavState) => void;
}) {
  const model = useTestPlayerModel(props);
  return (
    <PlayerShell
      data={props.data}
      testId={model.testId}
      bucketId={props.bucketId}
      runId={props.runId}
      frames={model.frames}
      nav={props.nav}
      actions={model.actions}
      selectedFrameIdx={model.selectedFrameIdx}
      hoverFrameIdx={model.hoverFrameIdx}
      playheadIdx={model.playheadIdx}
      previewIdx={model.previewIdx}
      previewFrame={model.previewFrame}
      holdRemainingMs={model.holdRemainingMs}
      previewSrc={model.previewSrc}
      registerCopyAction={model.registerCopyAction}
      onBack={model.onBack}
      onHover={model.onHover}
    />
  );
}

function useTestPlayerModel(props: {
  readonly data: SimulationReportData;
  readonly nav: ReportNavState;
  readonly bucketId: string;
  readonly runId: string;
  readonly onNav: (nav: ReportNavState) => void;
}) {
  const { data, nav, bucketId, runId, onNav } = props;
  const testId = data.meta.testId;
  const frames = useMemo(() => flattenFrames(data.steps), [data.steps]);
  const selectedFrameIdx = resolveSelectedFrameIndex(frames, data.steps, nav);
  const playheadIdx = playheadFrameIndex(selectedFrameIdx, frames.length);
  const [hoverFrameIdx, setHoverFrameIdx] = useState<number | null>(null);
  const previewIdx =
    !nav.play && hoverFrameIdx != null ? hoverFrameIdx : playheadIdx;
  const previewFrame =
    previewIdx >= 0 && previewIdx < frames.length
      ? (frames[previewIdx] ?? null)
      : null;
  const holdRemainingMs = useHoldCountdown({
    nav,
    activeFrameIdx: playheadIdx,
    previewFrame,
    minHoldMs: LONG_HOLD_PULSE_MS,
  });
  usePlayback({ nav, frames, activeFrameIdx: playheadIdx, testId, onNav });
  const previewSrc = previewFrame
    ? testFrameUrl(bucketId, runId, testId, previewFrame.file)
    : null;
  const actions = usePlayerActions({
    nav,
    onNav,
    testId,
    frames,
    selectedFrameIdx,
    playheadIdx,
  });
  const copyActionRef = useRef<() => void>(() => undefined);
  const registerCopyAction = useCallback((run: () => void) => {
    copyActionRef.current = run;
  }, []);
  const copyLlmPrompt = useCallback(() => {
    copyActionRef.current();
  }, []);
  const commandActions = useMemo(
    () => ({ ...actions, copyLlmPrompt }),
    [actions, copyLlmPrompt]
  );
  usePlayerCommands({
    nav,
    frames,
    previewIdx,
    actions: commandActions,
    onNav,
  });
  return {
    testId,
    frames,
    selectedFrameIdx,
    playheadIdx,
    hoverFrameIdx: !nav.play ? hoverFrameIdx : null,
    previewIdx,
    previewFrame,
    holdRemainingMs,
    previewSrc,
    actions,
    registerCopyAction,
    onBack: () => onNav(navigateReport(nav, clearPlayerNav())),
    onHover: (idx: number | null) => {
      if (!nav.play) setHoverFrameIdx(idx);
    },
  };
}

function PlayerShell(props: {
  readonly data: SimulationReportData;
  readonly testId: string;
  readonly bucketId: string;
  readonly runId: string;
  readonly frames: readonly FlatFrame[];
  readonly nav: ReportNavState;
  readonly actions: PlayerActions;
  readonly selectedFrameIdx: number | null;
  readonly hoverFrameIdx: number | null;
  readonly playheadIdx: number;
  readonly previewIdx: number;
  readonly previewFrame: FlatFrame | null;
  readonly holdRemainingMs: number | null;
  readonly previewSrc: string | null;
  readonly registerCopyAction: (run: () => void) => void;
  readonly onBack: () => void;
  readonly onHover: (idx: number | null) => void;
}) {
  const {
    data,
    testId,
    bucketId,
    runId,
    frames,
    nav,
    actions,
    selectedFrameIdx,
    hoverFrameIdx,
    playheadIdx,
    previewIdx,
    previewFrame,
    holdRemainingMs,
    previewSrc,
    registerCopyAction,
    onBack,
    onHover,
  } = props;
  return (
    <div style={styles.appShell}>
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
          <>
            <CopyLlmPromptButton
              data={data}
              bucketId={bucketId}
              runId={runId}
              selectedFrameIdx={selectedFrameIdx}
              playheadIdx={playheadIdx}
              previewIdx={previewIdx}
              registerCopyAction={registerCopyAction}
            />
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
          </>
        }
      />
      <div style={styles.playerLayout}>
        <FrameRail
          frames={frames}
          selectedIdx={selectedFrameIdx}
          hoverIdx={hoverFrameIdx}
          playheadIdx={playheadIdx}
          holdRemainingMs={holdRemainingMs}
          onHover={onHover}
          onSelect={actions.toggleFrame}
        />
        <PlayerStage previewFrame={previewFrame} previewSrc={previewSrc} />
      </div>
    </div>
  );
}

type PlayerActions = {
  readonly selectFrame: (
    frameIdx: number,
    historyMode: 'push' | 'replace'
  ) => void;
  readonly toggleFrame: (frameIdx: number) => void;
  readonly clearFrame: () => void;
  readonly setPlay: (play: boolean) => void;
  readonly setMode: (mode: PlayMode) => void;
  readonly setSpeed: (speed: PlaySpeed) => void;
};

function usePlayerActions(args: {
  readonly nav: ReportNavState;
  readonly onNav: (nav: ReportNavState) => void;
  readonly testId: string;
  readonly frames: readonly FlatFrame[];
  readonly selectedFrameIdx: number | null;
  readonly playheadIdx: number;
}): PlayerActions {
  const { nav, onNav, testId, frames, selectedFrameIdx, playheadIdx } = args;

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

  const clearFrame = useCallback(() => {
    onNav(
      navigateReport(nav, { frame: null, step: null, play: false }, 'push')
    );
  }, [nav, onNav]);

  const toggleFrame = useCallback(
    (frameIdx: number) => {
      if (selectedFrameIdx === frameIdx) {
        clearFrame();
        return;
      }
      selectFrame(frameIdx, 'push');
    },
    [clearFrame, selectFrame, selectedFrameIdx]
  );

  const setPlay = useCallback(
    (play: boolean) => {
      let frameIdx = playheadIdx;
      if (play && (frameIdx < 0 || frameIdx >= frames.length - 1)) frameIdx = 0;
      const frame = frames[frameIdx];
      onNav(
        navigateReport(
          nav,
          {
            testId,
            play,
            ...(play && frame
              ? { frame: frameIdx + 1, step: frame.step.index }
              : {}),
          },
          'replace'
        )
      );
    },
    [frames, nav, onNav, playheadIdx, testId]
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
    () => ({
      selectFrame,
      toggleFrame,
      clearFrame,
      setPlay,
      setMode,
      setSpeed,
    }),
    [selectFrame, toggleFrame, clearFrame, setPlay, setMode, setSpeed]
  );
}

function usePlayerCommands(args: {
  readonly nav: ReportNavState;
  readonly frames: readonly FlatFrame[];
  readonly previewIdx: number;
  readonly actions: PlayerActions & { readonly copyLlmPrompt: () => void };
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
