import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SimulationReportData } from '../types';
import { buildPlayerCommands } from './commands/player-commands';
import { useRegisterCommands } from './commands/registry';
import { FrameTimeline, LONG_HOLD_PULSE_MS } from './frame-timeline';
import {
  type FlatFrame,
  flattenFrames,
  playheadFrameIndex,
  resolveSelectedFrameIndex,
} from './frames';
import { listReportNodes, NodeWorkspace } from './node-workspace';
import { playbackHoldMs } from './playback-hold';
import { PlayerChrome } from './player-chrome';
import type { PlayMode, PlaySpeed, ReportNavState } from './router';
import { clearPlayerNav, navigateReport } from './router';
import { styles } from './theme';
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
      prevFrame={model.prevFrame}
      holdRemainingMs={model.holdRemainingMs}
      nodeId={model.nodeId}
      registerCopyAction={model.registerCopyAction}
      onBack={model.onBack}
      onHover={model.onHover}
      onSelectNode={model.selectNode}
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
  const { data, nav, onNav } = props;
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
  const prevFrame =
    previewIdx > 0 && previewIdx < frames.length
      ? (frames[previewIdx - 1] ?? null)
      : null;
  const holdRemainingMs = useHoldCountdown({
    nav,
    activeFrameIdx: playheadIdx,
    previewFrame,
    minHoldMs: LONG_HOLD_PULSE_MS,
  });
  usePlayback({ nav, frames, activeFrameIdx: playheadIdx, testId, onNav });
  const actions = usePlayerActions({
    nav,
    onNav,
    testId,
    frames,
    selectedFrameIdx,
    playheadIdx,
  });
  const nodeId = resolveNodeId(data, previewFrame, nav.node);
  const selectNode = useCallback(
    (next: string) => {
      onNav(navigateReport(nav, { node: next }, 'replace'));
    },
    [nav, onNav]
  );
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
    prevFrame,
    holdRemainingMs,
    nodeId,
    actions,
    registerCopyAction,
    selectNode,
    onBack: () => onNav(navigateReport(nav, clearPlayerNav())),
    onHover: (idx: number | null) => {
      if (!nav.play) setHoverFrameIdx(idx);
    },
  };
}

function resolveNodeId(
  data: SimulationReportData,
  frame: FlatFrame | null,
  navNode: string | null
): string {
  const nodes = listReportNodes(data, frame);
  if (navNode && nodes.includes(navNode)) return navNode;
  return nodes[0] ?? 'server';
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
  readonly prevFrame: FlatFrame | null;
  readonly holdRemainingMs: number | null;
  readonly nodeId: string;
  readonly registerCopyAction: (run: () => void) => void;
  readonly onBack: () => void;
  readonly onHover: (idx: number | null) => void;
  readonly onSelectNode: (nodeId: string) => void;
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
    prevFrame,
    holdRemainingMs,
    nodeId,
    registerCopyAction,
    onBack,
    onHover,
    onSelectNode,
  } = props;
  return (
    <div style={styles.appShell}>
      <PlayerChrome
        data={data}
        testId={testId}
        bucketId={bucketId}
        runId={runId}
        frames={frames}
        selectedFrameIdx={selectedFrameIdx}
        playheadIdx={playheadIdx}
        previewIdx={previewIdx}
        registerCopyAction={registerCopyAction}
        onBack={onBack}
      >
        <div style={styles.playerEditorLayout}>
          <NodeWorkspace
            data={data}
            bucketId={bucketId}
            runId={runId}
            testId={testId}
            frame={previewFrame}
            prevFrame={prevFrame}
            nodeId={nodeId}
            onSelectNode={onSelectNode}
          />
          <div style={styles.bottomStrip}>
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
            <FrameTimeline
              frames={frames}
              selectedIdx={selectedFrameIdx}
              hoverIdx={hoverFrameIdx}
              playheadIdx={playheadIdx}
              holdRemainingMs={holdRemainingMs}
              onHover={onHover}
              onSelect={actions.toggleFrame}
            />
          </div>
        </div>
      </PlayerChrome>
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
    () =>
      buildPlayerCommands({
        nav,
        frames,
        previewIdx,
        actions,
        onNav,
      }),
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
