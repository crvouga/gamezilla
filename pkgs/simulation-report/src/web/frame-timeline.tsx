import {
  type RefObject,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { FlatFrame } from './frames';
import { formatMsStable } from './frames';
import { durationHeat } from './heat';
import { merge, styles, t } from './theme';
import {
  computeSegmentWidths,
  frameDatabasesChanged,
  TIMELINE_SEG_GAP_PX,
  zoomAbout,
} from './timeline-layout';

export const LONG_HOLD_PULSE_MS = 1000;

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
  const trackRef = useRef<HTMLDivElement>(null);
  const [trackWidth, setTrackWidth] = useState(0);
  const [zoom, setZoom] = useState(1);
  const pinchRef = useRef<{ dist: number; zoom: number } | null>(null);

  useTrackWidth(trackRef, setTrackWidth);
  useTimelineZoomGestures({
    trackRef,
    zoom,
    setZoom,
    pinchRef,
  });

  const widths = useMemo(() => {
    if (frames.length === 0 || trackWidth <= 0) {
      return frames.map(() => 0);
    }
    return computeSegmentWidths({
      durations: frames.map((f) => f.durationMs),
      trackWidth,
      zoom,
      gapPx: TIMELINE_SEG_GAP_PX,
    });
  }, [frames, trackWidth, zoom]);

  return (
    <div
      ref={trackRef}
      style={styles.timelineTrack}
      aria-label="Frame timeline"
      onMouseLeave={() => onHover(null)}
    >
      {frames.map((frame, i) => {
        const prev = i > 0 ? frames[i - 1] : undefined;
        const db = frameDatabasesChanged(prev?.databases, frame.databases);
        return (
          <TimelineSeg
            key={`${frame.file}-${i}`}
            frame={frame}
            index={i}
            width={widths[i] ?? 0}
            showStep={i === 0 || prev!.stepIndex !== frame.stepIndex}
            selected={selectedIdx === i}
            hovered={hoverIdx === i}
            playhead={playheadIdx === i}
            holdRemainingMs={holdRemainingMs}
            dbChanged={db.changed}
            dbChangedCount={db.changedCount}
            onHover={onHover}
            onSelect={onSelect}
          />
        );
      })}
      {frames.length === 0 ? (
        <div style={styles.mutedEmpty}>No frames</div>
      ) : null}
    </div>
  );
}

function useTrackWidth(
  trackRef: RefObject<HTMLDivElement | null>,
  setTrackWidth: (w: number) => void
): void {
  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    const update = () => setTrackWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [trackRef, setTrackWidth]);
}

function useTimelineZoomGestures(args: {
  readonly trackRef: RefObject<HTMLDivElement | null>;
  readonly zoom: number;
  readonly setZoom: (z: number) => void;
  readonly pinchRef: RefObject<{ dist: number; zoom: number } | null>;
}): void {
  const { trackRef, zoom, setZoom, pinchRef } = args;
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  const applyZoomAt = useCallback(
    (clientX: number, nextZoom: number) => {
      const el = trackRef.current;
      if (!el) {
        setZoom(nextZoom);
        return;
      }
      const prevZoom = zoomRef.current;
      if (nextZoom === prevZoom) return;
      const rect = el.getBoundingClientRect();
      const x = clientX - rect.left + el.scrollLeft;
      const ratio = prevZoom > 0 ? nextZoom / prevZoom : 1;
      setZoom(nextZoom);
      requestAnimationFrame(() => {
        el.scrollLeft = Math.max(0, x * ratio - (clientX - rect.left));
      });
    },
    [setZoom, trackRef]
  );

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      applyZoomAt(e.clientX, zoomAbout({ zoom: zoomRef.current, delta }));
    };

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length !== 2) {
        pinchRef.current = null;
        return;
      }
      const a = e.touches[0]!;
      const b = e.touches[1]!;
      pinchRef.current = {
        dist: Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY),
        zoom: zoomRef.current,
      };
    };

    const onTouchMove = (e: TouchEvent) => {
      const pinch = pinchRef.current;
      if (!pinch || e.touches.length !== 2) return;
      e.preventDefault();
      const a = e.touches[0]!;
      const b = e.touches[1]!;
      const dist = Math.hypot(b.clientX - a.clientX, b.clientY - a.clientY);
      if (pinch.dist <= 0) return;
      const midX = (a.clientX + b.clientX) / 2;
      applyZoomAt(
        midX,
        zoomAbout({ zoom: pinch.zoom, delta: dist / pinch.dist })
      );
    };

    const onTouchEnd = () => {
      pinchRef.current = null;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);
    return () => {
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [applyZoomAt, pinchRef, trackRef]);
}

function TimelineSeg(props: {
  readonly frame: FlatFrame;
  readonly index: number;
  readonly width: number;
  readonly showStep: boolean;
  readonly selected: boolean;
  readonly hovered: boolean;
  readonly playhead: boolean;
  readonly holdRemainingMs: number | null;
  readonly dbChanged: boolean;
  readonly dbChangedCount: number;
  readonly onHover: (idx: number | null) => void;
  readonly onSelect: (idx: number) => void;
}) {
  const {
    frame,
    index,
    width,
    showStep,
    selected,
    hovered,
    playhead,
    holdRemainingMs,
    dbChanged,
    dbChangedCount,
    onHover,
    onSelect,
  } = props;
  const heat = durationHeat(frame.durationMs);
  const outline = selected
    ? `2px solid ${t.accent}`
    : playhead
      ? `1px solid ${t.text}`
      : hovered
        ? `1px solid ${t.muted}`
        : '1px solid transparent';
  const titleParts = [
    `#${index + 1}`,
    frame.step.title,
    formatMsStable(frame.durationMs),
  ];
  if (dbChanged) titleParts.push(`DB changed · ${dbChangedCount}`);
  return (
    <button
      type="button"
      title={titleParts.join(' · ')}
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
      {dbChanged ? <span style={styles.timelineDbMark} aria-hidden /> : null}
      {playhead ? <span style={styles.timelinePlayhead} /> : null}
    </button>
  );
}
