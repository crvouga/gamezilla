import { useCallback, useEffect, useMemo, useRef } from 'react';

import { buildPlayerCommands } from './commands/player-commands';
import { useRegisterCommands } from './commands/registry';
import type { FlatFrame } from './frames';
import { playbackHoldMs } from './playback-hold';
import type { PlayMode, PlaySpeed, ReportNavState } from './router';
import { navigateReport } from './router';

export type PlayerActions = {
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

export function usePlayerActions(args: {
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

export function usePlayerCommands(args: {
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

export function usePlayback(args: {
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
