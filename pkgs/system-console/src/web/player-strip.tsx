import { type Timers, useTimers } from '@pkgs/clock';
import { type CSSProperties, useEffect, useRef, useState } from 'react';

import type { FlatFrame } from './frames';
import { formatMs, formatMsStable } from './frames';
import { merge, styles, t, useHoverStyle } from './theme';
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
    <div style={strip}>
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
    </div>
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
  const prev = useHoverStyle(
    merge(styles.iconBtn, styles.iconBtnSm),
    styles.iconBtnHover,
    props.atStart
  );
  const play = useHoverStyle(
    merge(styles.iconBtn, styles.iconBtnMd, styles.iconBtnPrimary),
    styles.iconBtnHover
  );
  const next = useHoverStyle(
    merge(styles.iconBtn, styles.iconBtnSm),
    styles.iconBtnHover,
    props.atEnd
  );
  const spd = useHoverStyle(
    merge(styles.iconBtn, styles.iconBtnSm),
    styles.iconBtnHover
  );
  return (
    <div style={styles.transport}>
      <div style={styles.transportGroup}>
        <button
          type="button"
          aria-label="Previous frame"
          disabled={props.atStart}
          style={merge(prev.style, props.atStart && styles.iconBtnDisabled)}
          onMouseEnter={prev.onMouseEnter}
          onMouseLeave={prev.onMouseLeave}
          onClick={props.onPrev}
        >
          ‹
        </button>
        <button
          type="button"
          aria-label={props.playing ? 'Pause' : 'Play'}
          style={play.style}
          onMouseEnter={play.onMouseEnter}
          onMouseLeave={play.onMouseLeave}
          onClick={props.onTogglePlay}
        >
          {props.playing ? '❚❚' : '▶'}
        </button>
        <button
          type="button"
          aria-label="Next frame"
          disabled={props.atEnd}
          style={merge(next.style, props.atEnd && styles.iconBtnDisabled)}
          onMouseEnter={next.onMouseEnter}
          onMouseLeave={next.onMouseLeave}
          onClick={props.onNext}
        >
          ›
        </button>
      </div>
      <span style={styles.transportTimecode}>
        <span>{formatMsStable(props.elapsedMs)}</span>
        <span style={styles.tcSep}>/</span>
        <span style={styles.tcDur}>{formatMs(props.totalMs)}</span>
      </span>
      <button
        type="button"
        aria-label="Playback speed"
        style={spd.style}
        onMouseEnter={spd.onMouseEnter}
        onMouseLeave={spd.onMouseLeave}
        onClick={props.onCycleSpeed}
      >
        <span style={styles.transportLabelSpeed}>{props.speed}x</span>
      </button>
    </div>
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

const strip: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 0,
  borderBottom: `1px solid ${t.border}`,
  background: t.panel,
  flex: '0 0 auto',
  padding: '8px 12px 0',
};
