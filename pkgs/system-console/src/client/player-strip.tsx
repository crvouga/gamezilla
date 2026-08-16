import { type Timers, useTimers } from '@pkgs/clock';
import { Box, IconButton, Text } from '@pkgs/ui';
import { useEffect, useRef, useState } from 'react';

import type { FlatFrame } from './frames';
import { formatMs, formatMsStable } from './frames';
import { Timeline } from './timeline';

const SPEEDS = [1, 2, 4] as const;
type Speed = (typeof SPEEDS)[number];

export function PlayerStrip(props: {
  readonly frames: readonly FlatFrame[];
  readonly selectedIndex: number;
  readonly onSelect: (index: number) => void;
}) {
  const { frames, selectedIndex, onSelect } = props;
  const timers = useTimers();
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const timerRef = useRef<unknown>(null);

  useEffect(() => {
    clearPlayTimer(timers, timerRef);
    if (!playing || frames.length === 0) return;
    if (selectedIndex >= frames.length - 1) {
      setPlaying(false);
      return;
    }
    const frame = frames[selectedIndex]!;
    const waitMs = Math.max(16, frame.durationMs / speed);
    timerRef.current = timers.setTimeout(() => {
      onSelect(selectedIndex + 1);
    }, waitMs);
    return () => clearPlayTimer(timers, timerRef);
  }, [playing, selectedIndex, speed, frames, onSelect, timers]);

  const elapsed = elapsedBefore(frames, selectedIndex);
  const total = frames.reduce((sum, f) => sum + f.durationMs, 0);
  const atStart = selectedIndex <= 0;
  const atEnd = selectedIndex >= frames.length - 1;

  return (
    <Box sx={stripSx}>
      <Transport
        playing={playing}
        speed={speed}
        elapsedMs={elapsed}
        totalMs={total}
        atStart={atStart}
        atEnd={atEnd || frames.length === 0}
        onPrev={() => {
          setPlaying(false);
          if (!atStart) onSelect(selectedIndex - 1);
        }}
        onTogglePlay={() => setPlaying((p) => !p)}
        onNext={() => {
          setPlaying(false);
          if (!atEnd) onSelect(selectedIndex + 1);
        }}
        onCycleSpeed={() => {
          setSpeed((s) => nextSpeed(s));
        }}
      />
      <Timeline
        frames={frames}
        selectedIndex={Math.max(0, selectedIndex)}
        onSelect={(index) => {
          setPlaying(false);
          onSelect(index);
        }}
      />
    </Box>
  );
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
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 1.5 }}>
        <IconButton
          label="Previous frame"
          size={30}
          disabled={props.atStart}
          onPress={props.onPrev}
          background="surface"
        >
          <Text sx={{ fontSize: 12, color: 'text' }}>‹</Text>
        </IconButton>
        <IconButton
          label={props.playing ? 'Pause' : 'Play'}
          size={34}
          onPress={props.onTogglePlay}
          background="tintSubtle"
        >
          <Text sx={{ fontSize: 12, color: 'tint' }}>
            {props.playing ? '❚❚' : '▶'}
          </Text>
        </IconButton>
        <IconButton
          label="Next frame"
          size={30}
          disabled={props.atEnd}
          onPress={props.onNext}
          background="surface"
        >
          <Text sx={{ fontSize: 12, color: 'text' }}>›</Text>
        </IconButton>
      </Box>
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
        size={30}
        onPress={props.onCycleSpeed}
        background="surface"
      >
        <Text sx={{ fontSize: 11, color: 'text' }}>{`${props.speed}x`}</Text>
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
