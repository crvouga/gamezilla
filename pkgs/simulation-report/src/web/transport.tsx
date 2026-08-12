import {
  Gauge,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Timer,
  Zap,
} from 'lucide-react';
import type { CSSProperties, ReactNode } from 'react';

import type { FlatFrame } from './frames';
import { formatMsStable } from './frames';
import type { PlayMode, PlaySpeed, ReportNavState } from './router';
import { merge, styles, useHoverStyle } from './theme';

function padFrame(n: number, total: number): string {
  const w = String(Math.max(total, 1)).length;
  return String(n).padStart(w, '0');
}

export function Transport(props: {
  readonly nav: ReportNavState;
  readonly frames: readonly FlatFrame[];
  readonly previewIdx: number;
  readonly previewDurationMs: number | undefined;
  readonly compact?: boolean;
  readonly onTogglePlay: () => void;
  readonly onPrev: () => void;
  readonly onNext: () => void;
  readonly onMode: (mode: PlayMode) => void;
  readonly onSpeed: (speed: PlaySpeed) => void;
}) {
  const {
    nav,
    frames,
    previewIdx,
    previewDurationMs,
    compact = false,
    onTogglePlay,
    onPrev,
    onNext,
    onMode,
    onSpeed,
  } = props;
  const disabled = frames.length === 0;
  const btn = compact ? 'sm' : undefined;
  const total = frames.length;
  const frameDigits = String(Math.max(total, 1)).length;
  const cur =
    previewDurationMs != null
      ? padFrame((previewIdx >= 0 ? previewIdx : 0) + 1, total)
      : '—'.padStart(frameDigits, '—');
  const tot =
    previewDurationMs != null
      ? padFrame(total, total)
      : '—'.padStart(frameDigits, '—');

  const timecodeStyle: CSSProperties = merge(styles.transportTimecode, {
    gridTemplateColumns: `calc(${frameDigits} * 1ch) 1ch calc(${frameDigits} * 1ch) 1.25ch 6ch`,
  });

  return (
    <div
      style={merge(styles.transport, compact && styles.transportCompact)}
      aria-label="Playback"
    >
      <div style={styles.transportGroup}>
        <IconBtn
          label="Previous frame"
          size={btn ?? 'md'}
          disabled={disabled}
          onClick={onPrev}
        >
          <SkipBack size={compact ? 14 : 18} />
        </IconBtn>
        <IconBtn
          label={nav.play ? 'Pause' : 'Play'}
          size={btn ?? 'lg'}
          variant="primary"
          disabled={disabled}
          onClick={onTogglePlay}
        >
          {nav.play ? (
            <Pause size={compact ? 14 : 22} />
          ) : (
            <Play size={compact ? 14 : 22} />
          )}
        </IconBtn>
        <IconBtn
          label="Next frame"
          size={btn ?? 'md'}
          disabled={disabled}
          onClick={onNext}
        >
          <SkipForward size={compact ? 14 : 18} />
        </IconBtn>
      </div>
      <div style={styles.transportGroup}>
        <IconBtn
          label={`Mode ${nav.mode}`}
          size="sm"
          onClick={() => onMode(nav.mode === 'realtime' ? 'fixed' : 'realtime')}
        >
          {nav.mode === 'realtime' ? <Timer size={14} /> : <Zap size={14} />}
          <span style={merge(styles.transportLabel, styles.transportLabelMode)}>
            {nav.mode}
          </span>
        </IconBtn>
        <IconBtn
          label={`Speed ${nav.speed}×`}
          size="sm"
          onClick={() => onSpeed(cycleSpeed(nav.speed))}
        >
          <Gauge size={14} />
          <span
            style={merge(styles.transportLabel, styles.transportLabelSpeed)}
          >
            {nav.speed}×
          </span>
        </IconBtn>
      </div>
      <span style={timecodeStyle}>
        <span>{cur}</span>
        <span style={styles.tcSep}>/</span>
        <span>{tot}</span>
        <span style={styles.tcSep}>·</span>
        <span style={styles.tcDur}>{formatMsStable(previewDurationMs)}</span>
      </span>
    </div>
  );
}

function cycleSpeed(speed: PlaySpeed): PlaySpeed {
  if (speed === 0.5) return 1;
  if (speed === 1) return 2;
  return 0.5;
}

function IconBtn(props: {
  readonly label: string;
  readonly size: 'sm' | 'md' | 'lg';
  readonly variant?: 'primary';
  readonly disabled?: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
}) {
  const { label, size, variant, disabled, onClick, children } = props;
  const sizeStyle =
    size === 'sm'
      ? styles.iconBtnSm
      : size === 'lg'
        ? styles.iconBtnLg
        : styles.iconBtnMd;
  const base = merge(
    styles.iconBtn,
    sizeStyle,
    variant === 'primary' && styles.iconBtnPrimary,
    disabled && styles.iconBtnDisabled
  );
  const hover = useHoverStyle(base, styles.iconBtnHover, disabled);
  return (
    <button
      type="button"
      style={hover.style}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={hover.onMouseEnter}
      onMouseLeave={hover.onMouseLeave}
    >
      {children}
    </button>
  );
}
