import type { FlatFrame } from './frames';
import { formatMsStable } from './frames';
import { durationHeat } from './heat';
import { merge, styles, t } from './theme';

export const LONG_HOLD_PULSE_MS = 1000;

const MIN_SEG_PX = 10;
const PX_PER_MS = 0.04;

export function FrameTimeline(props: {
  readonly frames: readonly FlatFrame[];
  readonly selectedIdx: number | null;
  readonly hoverIdx: number | null;
  readonly playheadIdx: number;
  readonly holdRemainingMs?: number | null;
  readonly onHover: (idx: number | null) => void;
  readonly onSelect: (idx: number) => void;
}) {
  const {
    frames,
    selectedIdx,
    hoverIdx,
    playheadIdx,
    holdRemainingMs = null,
    onHover,
    onSelect,
  } = props;

  return (
    <div
      style={styles.timelineTrack}
      aria-label="Frame timeline"
      onMouseLeave={() => onHover(null)}
    >
      {frames.map((frame, i) => (
        <TimelineSeg
          key={`${frame.file}-${i}`}
          frame={frame}
          index={i}
          showStep={i === 0 || frames[i - 1]!.stepIndex !== frame.stepIndex}
          selected={selectedIdx === i}
          hovered={hoverIdx === i}
          playhead={playheadIdx === i}
          holdRemainingMs={holdRemainingMs}
          onHover={onHover}
          onSelect={onSelect}
        />
      ))}
      {frames.length === 0 ? (
        <div style={styles.mutedEmpty}>No frames</div>
      ) : null}
    </div>
  );
}

function TimelineSeg(props: {
  readonly frame: FlatFrame;
  readonly index: number;
  readonly showStep: boolean;
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly playhead: boolean;
  readonly holdRemainingMs: number | null;
  readonly onHover: (idx: number | null) => void;
  readonly onSelect: (idx: number) => void;
}) {
  const {
    frame,
    index,
    showStep,
    selected,
    hovered,
    playhead,
    holdRemainingMs,
    onHover,
    onSelect,
  } = props;
  const width = Math.max(MIN_SEG_PX, Math.round(frame.durationMs * PX_PER_MS));
  const heat = durationHeat(frame.durationMs);
  const outline = selected
    ? `2px solid ${t.accent}`
    : playhead
      ? `1px solid ${t.text}`
      : hovered
        ? `1px solid ${t.muted}`
        : '1px solid transparent';
  return (
    <button
      type="button"
      title={`#${index + 1} ${frame.step.title} · ${formatMsStable(frame.durationMs)}`}
      style={merge(styles.timelineSeg, {
        width,
        background: heat.cssColor,
        outline,
        opacity:
          playhead && holdRemainingMs != null ? 0.85 : selected ? 1 : 0.9,
      })}
      onMouseEnter={() => onHover(index)}
      onClick={() => onSelect(index)}
    >
      {showStep ? (
        <span style={styles.timelineSegLabel}>{frame.step.index}</span>
      ) : null}
      {playhead ? <span style={styles.timelinePlayhead} /> : null}
    </button>
  );
}
