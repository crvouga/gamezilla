import type { HtmlReportTest } from '@pkgs/sim';
import { createMemo, For, onCleanup, onMount } from 'solid-js';

import type { ReportNav } from '../app/use-report-nav';
import type { FlatFrame } from '../lib/frames';

function scrubPct(frames: FlatFrame[], sel: FlatFrame | null): number {
  if (!frames.length) return 0;
  const idx = sel ? sel.index : 0;
  return frames.length <= 1 ? 0 : (idx / (frames.length - 1)) * 100;
}

function Filmstrip(props: {
  frames: FlatFrame[];
  selected: FlatFrame | null;
  onSelect: (f: FlatFrame) => void;
}) {
  return (
    <div class="sr-film">
      <For each={props.frames}>
        {(f) => (
          <div
            class="sr-thumb"
            classList={{
              on: f === props.selected,
              failed: f.step.status === 'failed',
            }}
            title={f.step.title}
            data-film-index={String(f.index)}
            onClick={() => props.onSelect(f)}
          >
            <div class="n">{f.index + 1}</div>
            <div class="t">{f.step.title}</div>
            {f.step.hit ? <span class="sr-hit-dot" /> : null}
          </div>
        )}
      </For>
    </div>
  );
}

function bindScrubPointers(
  track: HTMLDivElement,
  nav: ReportNav,
  frames: () => FlatFrame[]
): void {
  let dragging = false;
  const seek = (clientX: number) => {
    const list = frames();
    if (!list.length) return;
    const rect = track.getBoundingClientRect();
    let t = rect.width <= 0 ? 0 : (clientX - rect.left) / rect.width;
    t = Math.max(0, Math.min(1, t));
    const i = list.length <= 1 ? 0 : Math.round(t * (list.length - 1));
    const frame = list[i];
    if (frame) nav.goFrame(frame);
  };
  const onDown = (e: PointerEvent) => {
    if (frames().length === 0) return;
    e.preventDefault();
    dragging = true;
    nav.stopPlay();
    track.classList.add('dragging');
    track.setPointerCapture(e.pointerId);
    seek(e.clientX);
  };
  const onMove = (e: PointerEvent) => {
    if (dragging) seek(e.clientX);
  };
  const endDrag = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('dragging');
    try {
      track.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  };
  track.addEventListener('pointerdown', onDown);
  track.addEventListener('pointermove', onMove);
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);
  onCleanup(() => {
    track.removeEventListener('pointerdown', onDown);
    track.removeEventListener('pointermove', onMove);
    track.removeEventListener('pointerup', endDrag);
    track.removeEventListener('pointercancel', endDrag);
  });
}

function onScrubKey(
  e: KeyboardEvent,
  frames: FlatFrame[],
  nav: ReportNav
): void {
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    nav.stepFrame(-1);
  }
  if (e.key === 'ArrowRight') {
    e.preventDefault();
    nav.stepFrame(1);
  }
  if (e.key === 'Home' && frames.length) {
    e.preventDefault();
    nav.goFrame(frames[0] ?? null);
  }
  if (e.key === 'End' && frames.length) {
    e.preventDefault();
    nav.goFrame(frames[frames.length - 1] ?? null);
  }
}

function ScrubTrack(props: {
  frames: FlatFrame[];
  selected: FlatFrame | null;
  pct: number;
  nav: ReportNav;
}) {
  let trackEl: HTMLDivElement | undefined;
  const idx = () => (props.selected ? props.selected.index : -1);

  onMount(() => {
    if (trackEl) bindScrubPointers(trackEl, props.nav, () => props.frames);
  });

  return (
    <div
      ref={trackEl}
      class="sr-scrub-track"
      role="slider"
      tabindex="0"
      aria-label="Frame scrubber"
      aria-valuemin={1}
      aria-valuemax={Math.max(1, props.frames.length)}
      aria-valuenow={Math.max(0, idx() + 1)}
      aria-valuetext={
        props.selected
          ? `Frame ${idx() + 1} of ${props.frames.length}`
          : 'No frames'
      }
      data-scrub-track=""
      onKeyDown={(e) => onScrubKey(e, props.frames, props.nav)}
    >
      <div class="sr-scrub-rail" />
      <div
        class="sr-scrub-fill"
        data-scrub-fill=""
        style={{ width: `${props.pct}%` }}
      />
      <div
        class="sr-scrub-knob"
        data-scrub-knob=""
        style={{ left: `${props.pct}%` }}
      />
    </div>
  );
}

export function Scrubber(props: {
  test: HtmlReportTest;
  frames: FlatFrame[];
  selected: FlatFrame | null;
  nav: ReportNav;
}) {
  const idx = createMemo(() => (props.selected ? props.selected.index : -1));
  const pct = createMemo(() => scrubPct(props.frames, props.selected));

  return (
    <div class="sr-scrubber">
      <div class="sr-scrubber-row">
        <button
          type="button"
          class="sr-navbtn"
          disabled={idx() <= 0}
          onClick={() => props.nav.stepFrame(-1)}
        >
          ◂
        </button>
        <button
          type="button"
          class="sr-navbtn"
          onClick={() => props.nav.togglePlay()}
        >
          {props.nav.playing() ? 'Pause' : 'Play'}
        </button>
        <button
          type="button"
          class="sr-navbtn"
          disabled={idx() < 0 || idx() >= props.frames.length - 1}
          onClick={() => props.nav.stepFrame(1)}
        >
          ▸
        </button>
        <ScrubTrack
          frames={props.frames}
          selected={props.selected}
          pct={pct()}
          nav={props.nav}
        />
        <span class="sr-frame-label" data-scrub-label="">
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
