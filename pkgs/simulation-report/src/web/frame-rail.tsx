import { type CSSProperties, type RefObject, useEffect, useRef } from 'react';

import type { FlatFrame } from './frames';
import { formatMsStable } from './frames';
import { durationHeat } from './heat';
import { holdPulseOpacity, merge, styles, t } from './theme';
import { wallNowMs } from './wall';

/** Only pulse / countdown when playback hold exceeds this. */
export const LONG_HOLD_PULSE_MS = 1000;

export function FrameRail(props: {
  readonly frames: readonly FlatFrame[];
  /** Explicit click selection; null when none selected. */
  readonly selectedIdx: number | null;
  /** Hover preview index; null when not hovering. */
  readonly hoverIdx: number | null;
  /** Playback / default playhead (0 when none selected). */
  readonly playheadIdx: number;
  readonly maxDurationMs: number;
  /** Remaining hold ms for the playhead row while playing a long wait. */
  readonly holdRemainingMs?: number | null;
  readonly onHover: (idx: number | null) => void;
  readonly onSelect: (idx: number) => void;
}) {
  const {
    frames,
    selectedIdx,
    hoverIdx,
    playheadIdx,
    maxDurationMs,
    holdRemainingMs = null,
    onHover,
    onSelect,
  } = props;
  const holdingLong = holdRemainingMs != null;
  const scrollRef = useRef<HTMLButtonElement | null>(null);
  const pulse = holdingLong ? holdPulseOpacity(wallNowMs()) : undefined;
  const scrollKey = selectedIdx ?? playheadIdx;

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [scrollKey]);

  return (
    <nav
      style={styles.frameRail}
      aria-label="Frames"
      onMouseLeave={() => onHover(null)}
    >
      {frames.map((frame, i) => {
        const prev = i > 0 ? frames[i - 1] : undefined;
        const showStep =
          prev === undefined || prev.stepIndex !== frame.stepIndex;
        const heat = durationHeat(frame.durationMs, maxDurationMs);
        const selected = selectedIdx === i;
        const hovered = hoverIdx === i;
        const playhead = playheadIdx === i;
        const holding = playhead && holdingLong;
        return (
          <RailFrameButton
            key={`${frame.file}-${i}`}
            scrollRef={
              selected || (selectedIdx == null && playhead)
                ? scrollRef
                : undefined
            }
            frame={frame}
            index={i}
            showStep={showStep}
            heatCss={heat.cssColor}
            selected={selected}
            hovered={hovered}
            playhead={playhead}
            holding={holding}
            holdRemainingMs={holdRemainingMs}
            pulseOpacity={holding ? pulse : undefined}
            onHover={onHover}
            onSelect={onSelect}
          />
        );
      })}
    </nav>
  );
}

function RailFrameButton(props: {
  readonly scrollRef: RefObject<HTMLButtonElement | null> | undefined;
  readonly frame: FlatFrame;
  readonly index: number;
  readonly showStep: boolean;
  readonly heatCss: string;
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly playhead: boolean;
  readonly holding: boolean;
  readonly holdRemainingMs: number | null;
  readonly pulseOpacity: number | undefined;
  readonly onHover: (idx: number | null) => void;
  readonly onSelect: (idx: number) => void;
}) {
  const {
    scrollRef,
    frame,
    index,
    showStep,
    heatCss,
    selected,
    hovered,
    playhead,
    holding,
    holdRemainingMs,
    pulseOpacity,
    onHover,
    onSelect,
  } = props;
  const failed = frame.step.status === 'failed';
  const btnStyle = merge(
    styles.railFrame,
    showStep && styles.railFrameHasStep,
    selected && styles.railFrameSelected,
    !selected && hovered && styles.railFrameHover,
    !selected && !hovered && playhead && styles.railFramePlayhead
  );
  const heatStyle: CSSProperties = merge(styles.railHeat, {
    background: heatCss,
    ...(pulseOpacity != null ? { opacity: pulseOpacity } : null),
  });
  const metaStyle = merge(styles.railMeta, failed && styles.railMetaFailed);
  const durStyle = merge(
    styles.railDur,
    holding
      ? {
          color: t.accent,
          ...(pulseOpacity != null ? { opacity: pulseOpacity } : null),
        }
      : null
  );
  const dotStyle = merge(
    styles.railHoldDot,
    !holding && { visibility: 'hidden' as const },
    pulseOpacity != null && { opacity: pulseOpacity }
  );

  return (
    <button
      ref={scrollRef}
      type="button"
      style={btnStyle}
      aria-pressed={selected}
      title={`${frame.step.title} · ${formatMsStable(frame.durationMs).trim()}`}
      onMouseEnter={() => onHover(index)}
      onClick={() => onSelect(index)}
    >
      <span style={heatStyle} aria-hidden />
      <span style={styles.railBody}>
        {showStep ? (
          <span style={styles.railStep}>
            s{frame.step.index} · {frame.step.title}
          </span>
        ) : null}
        <span style={styles.railRow}>
          <span style={styles.railIdx}>{index + 1}</span>
          <span style={metaStyle}>
            <span style={dotStyle} aria-hidden />
            <span style={durStyle}>
              {formatMsStable(holding ? holdRemainingMs : frame.durationMs)}
            </span>
          </span>
        </span>
      </span>
    </button>
  );
}
