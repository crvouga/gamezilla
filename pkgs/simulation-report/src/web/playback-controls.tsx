import type { FlatFrame } from './frames';
import { formatMs } from './frames';
import type { PlayMode, PlaySpeed, ReportNavState } from './router';

export function PlaybackControls(props: {
  readonly nav: ReportNavState;
  readonly frames: readonly FlatFrame[];
  readonly previewIdx: number;
  readonly previewDurationMs: number | undefined;
  readonly onTogglePlay: () => void;
  readonly onMode: (mode: PlayMode) => void;
  readonly onSpeed: (speed: PlaySpeed) => void;
}) {
  const {
    nav,
    frames,
    previewIdx,
    previewDurationMs,
    onTogglePlay,
    onMode,
    onSpeed,
  } = props;
  return (
    <div className="controls" aria-label="Playback">
      <button
        type="button"
        className="btn primary"
        onClick={onTogglePlay}
        disabled={frames.length === 0}
      >
        {nav.play ? 'Pause' : 'Play'}
      </button>
      <label>
        Mode
        <select
          value={nav.mode}
          onChange={(e) => onMode(e.target.value as PlayMode)}
        >
          <option value="realtime">Realtime</option>
          <option value="fixed">Fixed step</option>
        </select>
      </label>
      <label>
        Speed
        <select
          value={String(nav.speed)}
          onChange={(e) => onSpeed(Number(e.target.value) as PlaySpeed)}
        >
          <option value="0.5">0.5×</option>
          <option value="1">1×</option>
          <option value="2">2×</option>
        </select>
      </label>
      <span className="spacer" />
      <span className="meta">
        {previewDurationMs != null
          ? `Frame ${(previewIdx >= 0 ? previewIdx : 0) + 1}/${frames.length} · ${formatMs(previewDurationMs)}`
          : 'No frames'}
      </span>
    </div>
  );
}
