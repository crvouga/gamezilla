import type { FlatFrame } from '../frames';
import type { PlaySpeed, ReportNavState } from '../router';
import { clearPlayerNav, navigateReport } from '../router';
import type { Command } from './types';

type PlayerCommandActions = {
  readonly selectFrame: (
    frameIdx: number,
    historyMode: 'push' | 'replace'
  ) => void;
  readonly setPlay: (play: boolean) => void;
  readonly setMode: (mode: 'realtime' | 'fixed') => void;
  readonly setSpeed: (speed: PlaySpeed) => void;
};

type BuildArgs = {
  readonly nav: ReportNavState;
  readonly frames: readonly FlatFrame[];
  readonly previewIdx: number;
  readonly actions: PlayerCommandActions;
  readonly onNav: (nav: ReportNavState) => void;
};

export function buildPlayerCommands(args: BuildArgs): Command[] {
  return [...playbackCommands(args), ...navCommands(args)];
}

function playbackCommands(args: BuildArgs): Command[] {
  const { nav, frames, previewIdx, actions } = args;
  const hasFrames = frames.length > 0;
  const last = Math.max(0, frames.length - 1);
  return [
    {
      id: 'play.toggle',
      label: nav.play ? 'Pause' : 'Play',
      section: 'Playback',
      shortcut: 'Space',
      match: (e) => e.code === 'Space' && !e.metaKey && !e.ctrlKey,
      when: () => hasFrames,
      run: () => actions.setPlay(!nav.play),
    },
    {
      id: 'frame.prev',
      label: 'Previous frame',
      section: 'Playback',
      shortcut: '←',
      match: (e) => e.key === 'ArrowLeft',
      when: () => hasFrames,
      run: () => actions.selectFrame(Math.max(0, previewIdx - 1), 'push'),
    },
    {
      id: 'frame.next',
      label: 'Next frame',
      section: 'Playback',
      shortcut: '→',
      match: (e) => e.key === 'ArrowRight',
      when: () => hasFrames,
      run: () => actions.selectFrame(Math.min(last, previewIdx + 1), 'push'),
    },
    {
      id: 'frame.first',
      label: 'First frame',
      section: 'Playback',
      shortcut: 'Home',
      match: (e) => e.key === 'Home',
      when: () => hasFrames,
      run: () => actions.selectFrame(0, 'push'),
    },
    {
      id: 'frame.last',
      label: 'Last frame',
      section: 'Playback',
      shortcut: 'End',
      match: (e) => e.key === 'End',
      when: () => hasFrames,
      run: () => actions.selectFrame(last, 'push'),
    },
    {
      id: 'mode.toggle',
      label: 'Toggle playback mode',
      section: 'Playback',
      shortcut: 'M',
      match: (e) => e.key.toLowerCase() === 'm',
      run: () =>
        actions.setMode(nav.mode === 'realtime' ? 'fixed' : 'realtime'),
    },
    {
      id: 'speed.cycle',
      label: 'Cycle speed',
      section: 'Playback',
      shortcut: ']',
      match: (e) => e.key === ']' || e.key.toLowerCase() === 'l',
      run: () => {
        const next: PlaySpeed =
          nav.speed === 0.5 ? 1 : nav.speed === 1 ? 2 : 0.5;
        actions.setSpeed(next);
      },
    },
    {
      id: 'play.stop',
      label: 'Stop playback',
      section: 'Playback',
      shortcut: 'Esc',
      match: (e) => e.key === 'Escape',
      when: () => nav.play,
      run: () => actions.setPlay(false),
    },
  ];
}

function navCommands(args: BuildArgs): Command[] {
  const { nav, onNav } = args;
  return [
    {
      id: 'nav.back',
      label: 'Back to run',
      section: 'Navigation',
      shortcut: 'Backspace',
      match: (e) => e.key === 'Backspace',
      run: () => onNav(navigateReport(nav, clearPlayerNav())),
    },
  ];
}
