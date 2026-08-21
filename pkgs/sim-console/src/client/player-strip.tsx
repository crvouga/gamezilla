import { type Timers, useTimers } from '@pkgs/clock';
import {
  Box,
  ChevronLeftIcon,
  ChevronRightIcon,
  IconButton,
  PauseIcon,
  PlayIcon,
  Text,
} from '@pkgs/ui';
import { useEffect, useRef, useState } from 'react';

import type { FlatFrame } from './frames';
import { formatMs, formatMsStable } from './frames';
import { playbackToggleAction } from './playback';
import { Timeline } from './timeline';

const SPEEDS = [1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

const TRANSPORT_SIZE = 40;
const TRANSPORT_ICON = 20;

export function PlayerStrip(props: {
  readonly frames: readonly FlatFrame[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}) {
  const playback = usePlayback(props);
  return (
    <Box sx={stripSx}>
      <Transport
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
    </Box>
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

function usePlayback(args: {
  readonly frames: readonly FlatFrame[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}): PlaybackApi {
  const { frames, selectedIndex, onSelect } = args;
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const restartRef = useRef(false);
  const atStart = selectedIndex <= 0;
  const atEnd = frames.length === 0 || selectedIndex >= frames.length - 1;
  usePlaybackAdvance({
    playing,
    frames,
    selectedIndex,
    speed,
    onSelect,
    restartRef,
    setPlaying,
  });
  return {
    playing,
    speed,
    atStart,
    atEnd,
    elapsedMs: elapsedBefore(frames, selectedIndex),
    totalMs: frames.reduce((sum, f) => sum + f.durationMs, 0),
    ...bindPlaybackButtons({
      playing,
      atStart,
      atEnd,
      selectedIndex,
      onSelect,
      setPlaying,
      setSpeed,
      restartRef,
    }),
  };
}

function usePlaybackAdvance(args: {
  readonly playing: boolean;
  readonly frames: readonly FlatFrame[];
  readonly selectedIndex: number;
  readonly speed: Speed;
  readonly onSelect: (index: number) => void;
  readonly restartRef: { current: boolean };
  readonly setPlaying: (playing: boolean) => void;
}): void {
  const {
    playing,
    frames,
    selectedIndex,
    speed,
    onSelect,
    restartRef,
    setPlaying,
  } = args;
  const timers = useTimers();
  const timerRef = useRef<unknown>(null);
  useEffect(() => {
    clearPlayTimer(timers, timerRef);
    if (!playing || frames.length === 0) return;
    if (selectedIndex >= frames.length - 1) {
      if (restartRef.current && selectedIndex !== 0) return;
      restartRef.current = false;
      setPlaying(false);
      return;
    }
    restartRef.current = false;
    const waitMs = Math.max(16, frames[selectedIndex]!.durationMs / speed);
    timerRef.current = timers.setTimeout(() => {
      onSelect(selectedIndex + 1);
    }, waitMs);
    return () => clearPlayTimer(timers, timerRef);
  }, [
    playing,
    selectedIndex,
    speed,
    frames,
    onSelect,
    timers,
    restartRef,
    setPlaying,
  ]);
}

function bindPlaybackButtons(args: {
  readonly playing: boolean;
  readonly atStart: boolean;
  readonly atEnd: boolean;
  readonly selectedIndex: number;
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
      if (!args.atStart) args.onSelect(args.selectedIndex - 1);
    },
    onTogglePlay: () => {
      const action = playbackToggleAction({
        playing: args.playing,
        atEnd: args.atEnd,
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
      if (!args.atEnd) args.onSelect(args.selectedIndex + 1);
    },
    onCycleSpeed: () => args.setSpeed((s) => nextSpeed(s)),
    onPickFrame: (index) => {
      stop();
      args.onSelect(index);
    },
  };
}

function Transport(props: {
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
  return (
    <Box
      sx={{
        flexDirection: 'row',
        flexWrap: 'nowrap',
        alignItems: 'center',
        gap: 3,
      }}
    >
      <TransportButtons {...props} />
      <Box sx={{ flexDirection: 'row', alignItems: 'baseline', gap: 0.5 }}>
        <Text sx={{ color: 'textSecondary', fontSize: 12 }}>
          {formatMsStable(props.elapsedMs)}
        </Text>
        <Text sx={{ color: 'textSecondary', fontSize: 12 }}>/</Text>
        <Text sx={{ color: 'textSecondary', fontSize: 12 }}>
          {formatMs(props.totalMs)}
        </Text>
      </Box>
      <IconButton
        label="Playback speed"
        size={TRANSPORT_SIZE}
        onPress={props.onCycleSpeed}
        background="surface"
      >
        <Text sx={{ fontSize: 12, color: 'text' }}>{`${props.speed}x`}</Text>
      </IconButton>
    </Box>
  );
}

function TransportButtons(props: {
  readonly playing: boolean;
  readonly atStart: boolean;
  readonly atEnd: boolean;
  readonly onPrev: () => void;
  readonly onTogglePlay: () => void;
  readonly onNext: () => void;
}) {
  const PlayFace = props.playing ? PauseIcon : PlayIcon;
  return (
    <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1.5 }}>
      <IconButton
        label="Previous frame"
        size={TRANSPORT_SIZE}
        disabled={props.atStart}
        onPress={props.onPrev}
        background="surface"
      >
        <ChevronLeftIcon size={TRANSPORT_ICON} />
      </IconButton>
      <IconButton
        label={props.playing ? 'Pause' : 'Play'}
        size={TRANSPORT_SIZE}
        onPress={props.onTogglePlay}
        background="tintSubtle"
      >
        <PlayFace size={TRANSPORT_ICON} color="tint" />
      </IconButton>
      <IconButton
        label="Next frame"
        size={TRANSPORT_SIZE}
        disabled={props.atEnd}
        onPress={props.onNext}
        background="surface"
      >
        <ChevronRightIcon size={TRANSPORT_ICON} />
      </IconButton>
    </Box>
  );
}

function clearPlayTimer(timers: Timers, ref: { current: unknown }): void {
  if (ref.current != null) {
    timers.clearTimeout(ref.current);
    ref.current = null;
  }
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
  flexDirection: 'column',
  borderBottomWidth: 1,
  borderColor: 'border',
  background: 'surface',
  paddingTop: 8,
  paddingHorizontal: 12,
  flexGrow: 0,
  flexShrink: 0,
} as const;
