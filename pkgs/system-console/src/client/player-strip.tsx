import { type Timers, useTimers } from '@pkgs/clock';
import { Box, Pressable, Text } from '@pkgs/ui';
import { useEffect, useRef, useState } from 'react';

import type { FlatFrame } from './frames';
import { formatMs, formatMsStable } from './frames';
import { Timeline } from './timeline';
import {
  iconBtnDisabledSx,
  iconBtnMdSx,
  iconBtnPrimarySx,
  iconBtnSmSx,
  iconBtnSx,
  t,
} from './tokens';

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
        gap: 12,
      }}
    >
      <Box sx={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <IconButton
          label="Previous frame"
          glyph="‹"
          size="sm"
          disabled={props.atStart}
          onPress={props.onPrev}
        />
        <IconButton
          label={props.playing ? 'Pause' : 'Play'}
          glyph={props.playing ? '❚❚' : '▶'}
          size="md"
          primary
          onPress={props.onTogglePlay}
        />
        <IconButton
          label="Next frame"
          glyph="›"
          size="sm"
          disabled={props.atEnd}
          onPress={props.onNext}
        />
      </Box>
      <Box sx={{ flexDirection: 'row', alignItems: 'baseline', gap: 2 }}>
        <Text sx={{ color: t.muted, fontSize: 12 }}>
          {formatMsStable(props.elapsedMs)}
        </Text>
        <Text sx={{ color: t.muted, fontSize: 12 }}>/</Text>
        <Text sx={{ color: t.muted, fontSize: 12 }}>
          {formatMs(props.totalMs)}
        </Text>
      </Box>
      <IconButton
        label="Playback speed"
        glyph={`${props.speed}x`}
        size="sm"
        onPress={props.onCycleSpeed}
      />
    </Box>
  );
}

function IconButton(props: {
  readonly label: string;
  readonly glyph: string;
  readonly size: 'sm' | 'md';
  readonly primary?: boolean;
  readonly disabled?: boolean;
  readonly onPress: () => void;
}) {
  const { label, glyph, size, primary, disabled, onPress } = props;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      sx={[
        iconBtnSx,
        size === 'sm' ? iconBtnSmSx : iconBtnMdSx,
        primary ? iconBtnPrimarySx : null,
        disabled ? iconBtnDisabledSx : null,
      ]}
      onPress={onPress}
    >
      <Text sx={{ color: primary ? t.accent : t.text, fontSize: 12 }}>
        {glyph}
      </Text>
    </Pressable>
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
  borderBottomColor: t.border,
  backgroundColor: t.panel,
  paddingTop: 8,
  paddingHorizontal: 12,
} as const;
