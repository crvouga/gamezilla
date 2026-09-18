import type { HtmlReportTest } from '@pkgs/sim';
import { createMemo, For, onCleanup } from 'solid-js';

import type { ReportNav } from '../app/use-report-nav';
import type { FlatFrame } from '../lib/frames';

function Filmstrip(props: {
  frames: FlatFrame[];
  selected: FlatFrame | null;
  onSelect: (f: FlatFrame) => void;
}) {
  return (
    <div class="sr-film" aria-label="Frame thumbnails">
      <For each={props.frames}>
        {(f) => (
          <button
            type="button"
            class="sr-thumb"
            classList={{
              on: f === props.selected,
              failed: f.step.status === 'failed',
            }}
            title={f.step.title}
            aria-label={`Frame ${f.index + 1}: ${f.step.title}`}
            aria-current={f === props.selected ? 'true' : undefined}
            data-film-index={String(f.index)}
            onClick={() => props.onSelect(f)}
          >
            <span class="n">{f.index + 1}</span>
            <span class="t">{f.step.title}</span>
            {f.step.hit ? <span class="sr-hit-dot" /> : null}
          </button>
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
      onChange={flush}
    />
  );
}

export function Scrubber(props: {
  test: HtmlReportTest;
  frames: FlatFrame[];
  selected: FlatFrame | null;
  nav: ReportNav;
}) {
  const idx = createMemo(() => (props.selected ? props.selected.index : -1));
  const pct = createMemo(() =>
    props.frames.length <= 1 || idx() < 0
      ? 0
      : (idx() / (props.frames.length - 1)) * 100
  );

  return (
    <div class="sr-scrubber">
      <div class="sr-scrubber-row">
        <button
          type="button"
          class="sr-navbtn"
          aria-label="Previous frame"
          title="Previous frame"
          disabled={idx() <= 0}
          onClick={() => props.nav.stepFrame(-1)}
        >
          ◂
        </button>
        <button
          type="button"
          class="sr-navbtn sr-play"
          aria-label={props.nav.playing() ? 'Pause playback' : 'Play frames'}
          onClick={() => props.nav.togglePlay()}
        >
          {props.nav.playing() ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          class="sr-navbtn"
          aria-label="Next frame"
          title="Next frame"
          disabled={idx() < 0 || idx() >= props.frames.length - 1}
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
        </div>
        <span class="sr-frame-label" aria-live="polite" data-scrub-label="">
          {props.selected ? `${idx() + 1} / ${props.frames.length}` : '0 / 0'}
        </span>
      </div>
      <Filmstrip
        frames={props.frames}
        selected={props.selected}
        onSelect={(f) => props.nav.goFrame(f)}
      />
    </div>
  );
}
