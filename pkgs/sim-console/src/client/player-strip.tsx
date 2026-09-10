import { useTimers } from '@pkgs/clock/solid';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  IconButton,
  PauseIcon,
  PlayIcon,
} from '@pkgs/ui';
import { createEffect, createSignal, onCleanup } from 'solid-js';

import { useSimConsoleLayout } from './debugger/use-sim-console-layout';
import type { FlatFrame } from './frames';
import { formatMs, formatMsStable } from './frames';
import { playbackToggleAction } from './playback';
import { Timeline } from './timeline';

const SPEEDS = [1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

const TRANSPORT_SIZE = 40;
const TRANSPORT_ICON = 20;
const TRANSPORT_SIZE_COMPACT = 36;
const TRANSPORT_ICON_COMPACT = 18;

export function PlayerStrip(props: {
  readonly frames: readonly FlatFrame[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}) {
  const playback = usePlayback(props);
  const layout = useSimConsoleLayout();
  return (
    <div class="box" style={stripSx}>
      <Transport
        compact={layout.compactChrome}
        playing={playback.playing}
        speed={playback.speed}
        elapsedMs={playback.elapsedMs}
        totalMs={playback.totalMs}
        atStart={playback.atStart}
        atEnd={playback.atEnd}
        onPrev={playback.onPrev}
        onTogglePlay={playback.onTogglePlay}
        onNext={playback.onNext}
        onCycleSpeed={playback.onCycleSpeed}
      />
      <Timeline
        mode="discrete"
        frames={props.frames}
        selectedIndex={Math.max(0, props.selectedIndex)}
        onSelect={playback.onPickFrame}
      />
    </div>
  );
}

type PlaybackApi = {
  readonly playing: boolean;
  readonly speed: Speed;
  readonly elapsedMs: number;
  readonly totalMs: number;
  readonly atStart: boolean;
  readonly atEnd: boolean;
  readonly onPrev: () => void;
  readonly onTogglePlay: () => void;
  readonly onNext: () => void;
  readonly onCycleSpeed: () => void;
  readonly onPickFrame: (index: number) => void;
};

function usePlayback(props: {
  readonly frames: readonly FlatFrame[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}): PlaybackApi {
  const [playing, setPlaying] = createSignal(false);
  const [speed, setSpeed] = createSignal<Speed>(1);
  const restartRef = { current: false };
  const atStart = () => props.selectedIndex <= 0;
  const atEnd = () =>
    props.frames.length === 0 || props.selectedIndex >= props.frames.length - 1;
  usePlaybackAdvance({
    playing,
    frames: () => props.frames,
    selectedIndex: () => props.selectedIndex,
    speed,
    onSelect: (index) => props.onSelect(index),
    restartRef,
    setPlaying,
  });
  return {
    get playing() {
      return playing();
    },
    get speed() {
      return speed();
    },
    get atStart() {
      return atStart();
    },
    get atEnd() {
      return atEnd();
    },
    get elapsedMs() {
      return elapsedBefore(props.frames, props.selectedIndex);
    },
    get totalMs() {
      return props.frames.reduce((sum, f) => sum + f.durationMs, 0);
    },
    ...bindPlaybackButtons({
      playing,
      atStart,
      atEnd,
      selectedIndex: () => props.selectedIndex,
      onSelect: (index) => props.onSelect(index),
      setPlaying,
      setSpeed,
      restartRef,
    }),
  };
}

function usePlaybackAdvance(args: {
  readonly playing: () => boolean;
  readonly frames: () => readonly FlatFrame[];
  readonly selectedIndex: () => number;
  readonly speed: () => Speed;
  readonly onSelect: (index: number) => void;
  readonly restartRef: { current: boolean };
  readonly setPlaying: (playing: boolean) => void;
}): void {
  const timers = useTimers();
  let timer: unknown = null;
  const clearTimer = () => {
    if (timer != null) {
      timers.clearTimeout(timer);
      timer = null;
    }
  };
  createEffect(() => {
    clearTimer();
    const playing = args.playing();
    const frames = args.frames();
    const selectedIndex = args.selectedIndex();
    const speed = args.speed();
    if (!playing || frames.length === 0) return;
    if (selectedIndex >= frames.length - 1) {
      if (args.restartRef.current && selectedIndex !== 0) return;
      args.restartRef.current = false;
      args.setPlaying(false);
      return;
    }
    args.restartRef.current = false;
    const waitMs = Math.max(16, frames[selectedIndex]!.durationMs / speed);
    timer = timers.setTimeout(() => {
      args.onSelect(selectedIndex + 1);
    }, waitMs);
    onCleanup(clearTimer);
  });
}

function bindPlaybackButtons(args: {
  readonly playing: () => boolean;
  readonly atStart: () => boolean;
  readonly atEnd: () => boolean;
  readonly selectedIndex: () => number;
  readonly onSelect: (index: number) => void;
  readonly setPlaying: (playing: boolean) => void;
  readonly setSpeed: (update: (s: Speed) => Speed) => void;
  readonly restartRef: { current: boolean };
}): Omit<
  PlaybackApi,
  'playing' | 'speed' | 'elapsedMs' | 'totalMs' | 'atStart' | 'atEnd'
> {
  const stop = () => {
    args.restartRef.current = false;
    args.setPlaying(false);
  };
  return {
    onPrev: () => {
      stop();
      if (!args.atStart()) args.onSelect(args.selectedIndex() - 1);
    },
    onTogglePlay: () => {
      const action = playbackToggleAction({
        playing: args.playing(),
        atEnd: args.atEnd(),
      });
      if (action === 'pause') {
        stop();
        return;
      }
      if (action === 'restart') {
        args.restartRef.current = true;
        args.onSelect(0);
      }
      args.setPlaying(true);
    },
    onNext: () => {
      stop();
      if (!args.atEnd()) args.onSelect(args.selectedIndex() + 1);
    },
    onCycleSpeed: () => args.setSpeed((s) => nextSpeed(s)),
    onPickFrame: (index) => {
      stop();
      args.onSelect(index);
    },
  };
}

function Transport(props: {
  readonly compact: boolean;
  readonly playing: boolean;
  readonly speed: Speed;
  readonly elapsedMs: number;
  readonly totalMs: number;
  readonly atStart: boolean;
  readonly atEnd: boolean;
  readonly onPrev: () => void;
  readonly onTogglePlay: () => void;
  readonly onNext: () => void;
  readonly onCycleSpeed: () => void;
}) {
  const size = () => (props.compact ? TRANSPORT_SIZE_COMPACT : TRANSPORT_SIZE);
  const icon = () => (props.compact ? TRANSPORT_ICON_COMPACT : TRANSPORT_ICON);
  return (
    <div
      class="box flex-row flex-nowrap items-center min-w-[0]"
      style={{ gap: `${(props.compact ? 1.5 : 3) * 4}px` }}
    >
      <TransportButtons
        size={size()}
        icon={icon()}
        playing={props.playing}
        atStart={props.atStart}
        atEnd={props.atEnd}
        onPrev={props.onPrev}
        onTogglePlay={props.onTogglePlay}
        onNext={props.onNext}
      />
      {props.compact ? null : (
        <div class="box flex-row items-baseline gap-0.5">
          <p class="text text-text-secondary text-[12px]">
            {formatMsStable(props.elapsedMs)}
          </p>
          <p class="text text-text-secondary text-[12px]">/</p>
          <p class="text text-text-secondary text-[12px]">
            {formatMs(props.totalMs)}
          </p>
        </div>
      )}
      <IconButton
        label="Playback speed"
        size={size()}
        onClick={props.onCycleSpeed}
        background="surface"
      >
        <p class="text text-[12px] text-text">{`${props.speed}x`}</p>
      </IconButton>
    </div>
  );
}

function TransportButtons(props: {
  readonly size: number;
  readonly icon: number;
  readonly playing: boolean;
  readonly atStart: boolean;
  readonly atEnd: boolean;
  readonly onPrev: () => void;
  readonly onTogglePlay: () => void;
  readonly onNext: () => void;
}) {
  return (
    <div class="box flex-row items-center gap-1.5">
      <IconButton
        label="Previous frame"
        size={props.size}
        disabled={props.atStart}
        onClick={props.onPrev}
        background="surface"
      >
        <ChevronLeftIcon size={props.icon} />
      </IconButton>
      <IconButton
        label={props.playing ? 'Pause' : 'Play'}
        size={props.size}
        onClick={props.onTogglePlay}
        background="tintSubtle"
      >
        {props.playing ? (
          <PauseIcon size={props.icon} color="tint" />
        ) : (
          <PlayIcon size={props.icon} color="tint" />
        )}
      </IconButton>
      <IconButton
        label="Next frame"
        size={props.size}
        disabled={props.atEnd}
        onClick={props.onNext}
        background="surface"
      >
        <ChevronRightIcon size={props.icon} />
      </IconButton>
    </div>
  );
}

function nextSpeed(current: Speed): Speed {
  const i = SPEEDS.indexOf(current);
  return SPEEDS[(i + 1) % SPEEDS.length]!;
}

function elapsedBefore(frames: readonly FlatFrame[], index: number): number {
  let sum = 0;
  for (let i = 0; i < index && i < frames.length; i++) {
    sum += frames[i]!.durationMs;
  }
  return sum;
}

const stripSx = {
  'flex-direction': 'column',
  'border-bottom-width': '1px',
  'border-bottom-style': 'solid',
  'border-bottom-color': 'var(--ui-color-border)',
  background: 'var(--ui-color-surface)',
  'padding-top': '32px',
  'padding-left': '48px',
  'padding-right': '48px',
  'flex-grow': 0,
  'flex-shrink': 0,
} as const;
