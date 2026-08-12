import { type CSSProperties, useEffect, useRef } from 'react';

import type { FlatFrame } from './frames';
import { formatMsStable } from './frames';
import { durationHeat } from './heat';

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

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [previewIdx]);

  return (
    <nav
      className="frame-rail"
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
          <button
            key={`${frame.file}-${i}`}
            ref={active ? activeRef : undefined}
            type="button"
            className={`rail-frame${active ? ' active' : ''}${
              holding ? ' is-holding' : ''
            }${frame.step.status === 'failed' ? ' failed' : ''}${
              showStep ? ' has-step' : ''
            }`}
            style={{ '--heat': heat.cssColor } as CSSProperties}
            title={`${frame.step.title} · ${formatMsStable(frame.durationMs).trim()}`}
            onMouseEnter={() => onHover(i)}
            onClick={() => onSelect(i)}
          >
            <span className="rail-heat" aria-hidden />
            <span className="rail-body">
              {showStep ? (
                <span className="rail-step">
                  s{frame.step.index} · {frame.step.title}
                </span>
              ) : null}
              <span className="rail-row">
                <span className="rail-idx">{i + 1}</span>
                <span className="rail-meta">
                  <span
                    className={`rail-hold-dot${holding ? '' : ' is-hidden'}`}
                    aria-hidden
                  />
                  <span className="rail-dur">
                    {formatMsStable(
                      holding ? holdRemainingMs : frame.durationMs
                    )}
                  </span>
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </nav>
  );
}
