import type { FlatFrame } from '@pkgs/harness-report-shared/frames';
import { createMemo, For, onCleanup } from 'solid-js';
import type { ReportNav } from './use-report-nav';

type Marker = {
  readonly frame: FlatFrame;
  readonly kind: 'fail' | 'press';
  readonly pct: number;
};

function pctOf(index: number, count: number): number {
  return count <= 1 ? 0 : (index / (count - 1)) * 100;
}

/** Failure + press ticks under the track — the timeline at a glance. */
function Markers(props: { frames: FlatFrame[]; nav: ReportNav }) {
  const markers = createMemo(() => {
    const out: Marker[] = [];
    const n = props.frames.length;
    for (const f of props.frames) {
      const pct = pctOf(f.index, n);
      if (f.step.status === 'failed') out.push({ frame: f, kind: 'fail', pct });
      else if (f.frame.hit) out.push({ frame: f, kind: 'press', pct });
    }
    return out;
  });
  return (
    <div class="sr-marks" aria-hidden="true">
      <For each={markers()}>
        {(m) => (
          <button
            type="button"
            tabindex="-1"
            class={`sr-mark ${m.kind}`}
            style={{ left: `${m.pct}%` }}
            title={`${m.frame.index + 1}: ${m.frame.step.title}`}
            onClick={() => props.nav.goFrame(m.frame)}
          />
        )}
      </For>
    </div>
  );
}

function ScrubTrack(props: {
  frames: FlatFrame[];
  selected: FlatFrame | null;
  nav: ReportNav;
}) {
  let pendingIndex: number | null = null;
  let rafId: number | null = null;
  const idx = () => (props.selected ? props.selected.index : -1);

  const flush = () => {
    rafId = null;
    if (pendingIndex === null) return;
    const frame = props.frames[pendingIndex];
    pendingIndex = null;
    if (frame) props.nav.goFrame(frame);
  };

  const schedule = (next: number) => {
    pendingIndex = next;
    if (rafId === null) rafId = requestAnimationFrame(flush);
  };

  onCleanup(() => {
    if (rafId !== null) cancelAnimationFrame(rafId);
  });

  return (
    <input
      class="sr-scrub-input"
      type="range"
      min="1"
      max={Math.max(1, props.frames.length)}
      value={Math.max(1, idx() + 1)}
      disabled={props.frames.length === 0}
      aria-label="Frame scrubber"
      aria-valuetext={
        props.selected
          ? `Frame ${idx() + 1} of ${props.frames.length}`
          : 'No frames'
      }
      data-scrub-track=""
      onInput={(e) => {
        props.nav.stopPlay();
        schedule(Number.parseInt(e.currentTarget.value, 10) - 1);
      }}
      onChange={() => {
        flush();
        props.nav.commitHash();
      }}
    />
  );
}

export function Scrubber(props: {
  frames: FlatFrame[];
  selected: FlatFrame | null;
  nav: ReportNav;
}) {
  const idx = createMemo(() => (props.selected ? props.selected.index : -1));
  const pct = createMemo(() => pctOf(idx(), props.frames.length));

  return (
    <div class="sr-scrubber">
      <button
        type="button"
        class="sr-navbtn"
        aria-label="Previous frame"
        title="Previous frame (←)"
        disabled={idx() <= 0}
        data-scrub-prev=""
        onClick={() => props.nav.stepFrame(-1)}
      >
        ◂
      </button>
      <button
        type="button"
        class="sr-navbtn sr-play"
        aria-label={props.nav.playing() ? 'Pause playback' : 'Play frames'}
        title="Play / pause (Space)"
        onClick={() => props.nav.togglePlay()}
      >
        {props.nav.playing() ? '❚❚' : '▶'}
      </button>
      <button
        type="button"
        class="sr-navbtn"
        aria-label="Next frame"
        title="Next frame (→)"
        disabled={idx() < 0 || idx() >= props.frames.length - 1}
        data-scrub-next=""
        onClick={() => props.nav.stepFrame(1)}
      >
        ▸
      </button>
      <div class="sr-scrub-wrap">
        <div class="sr-scrub-rail" />
        <div class="sr-scrub-fill" style={{ width: `${pct()}%` }} />
        <ScrubTrack
          frames={props.frames}
          selected={props.selected}
          nav={props.nav}
        />
        <Markers frames={props.frames} nav={props.nav} />
      </div>
      <span class="sr-frame-label" aria-live="polite" data-scrub-label="">
        {props.selected ? `${idx() + 1} / ${props.frames.length}` : '0 / 0'}
      </span>
    </div>
  );
}
