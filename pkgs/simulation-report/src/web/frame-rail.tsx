import {
  type CSSProperties,
  type RefObject,
  useEffect,
  useRef,
  useState,
} from 'react';

import type { FlatFrame } from './frames';
import { formatMsStable } from './frames';
import { durationHeat } from './heat';
import { holdPulseOpacity, merge, styles, t } from './theme';
import { wallNowMs } from './wall';

/** Only pulse / countdown when playback hold exceeds this. */
export const LONG_HOLD_PULSE_MS = 1000;

export function FrameRail(props: {
  readonly frames: readonly FlatFrame[];
  readonly previewIdx: number;
  readonly maxDurationMs: number;
  /** Remaining hold ms for the active row while playing a long wait. */
  readonly holdRemainingMs?: number | null;
  readonly onHover: (idx: number | null) => void;
  readonly onSelect: (idx: number) => void;
}) {
  const {
    frames,
    previewIdx,
    maxDurationMs,
    holdRemainingMs = null,
    onHover,
    onSelect,
  } = props;
  const holdingLong = holdRemainingMs != null;
  const activeRef = useRef<HTMLButtonElement | null>(null);
  const pulse = holdingLong ? holdPulseOpacity(wallNowMs()) : undefined;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [previewIdx]);

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
        const active = i === previewIdx;
        const holding = active && holdingLong;
        return (
          <RailFrameButton
            key={`${frame.file}-${i}`}
            activeRef={active ? activeRef : undefined}
            frame={frame}
            index={i}
            showStep={showStep}
            heatCss={heat.cssColor}
            active={active}
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
  readonly activeRef: RefObject<HTMLButtonElement | null> | undefined;
  readonly frame: FlatFrame;
  readonly index: number;
  readonly showStep: boolean;
  readonly heatCss: string;
  readonly active: boolean;
  readonly holding: boolean;
  readonly holdRemainingMs: number | null;
  readonly pulseOpacity: number | undefined;
  readonly onHover: (idx: number | null) => void;
  readonly onSelect: (idx: number) => void;
}) {
  const {
    activeRef,
    frame,
    index,
    showStep,
    heatCss,
    active,
    holding,
    holdRemainingMs,
    pulseOpacity,
    onHover,
    onSelect,
  } = props;
  const [hovered, setHovered] = useState(false);
  const failed = frame.step.status === 'failed';
  const btnStyle = merge(
    styles.railFrame,
    showStep && styles.railFrameHasStep,
    hovered && !active && styles.railFrameHover,
    active && styles.railFrameActive
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
      ref={activeRef}
      type="button"
      style={btnStyle}
      title={`${frame.step.title} · ${formatMsStable(frame.durationMs).trim()}`}
      onMouseEnter={() => {
        setHovered(true);
        onHover(index);
      }}
      onMouseLeave={() => setHovered(false)}
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
