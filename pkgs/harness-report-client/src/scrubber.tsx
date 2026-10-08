import { useLingui } from '@lingui/solid/macro';
import type { FlatFrame } from '@pkgs/harness-report-shared/frames';
import { IconButton } from '@pkgs/ui-root-client/icon-button';
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  PauseIcon,
  PlayIcon,
} from '@pkgs/ui-root-client/icons';
import { RangeControl } from '@pkgs/ui-root-client/range-control';
import { createMemo, For, onCleanup, Show } from 'solid-js';
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
  const { t } = useLingui();
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
    <RangeControl
      label={t`Frame scrubber`}
      min={1}
      max={Math.max(1, props.frames.length)}
      value={Math.max(1, idx() + 1)}
      disabled={props.frames.length === 0}
      valueText={
        props.selected
          ? t`Frame ${idx() + 1} of ${props.frames.length}`
          : t`No frames`
      }
      dataSet={{ 'scrub-track': '' }}
      onInput={(value) => {
        props.nav.stopPlay();
        schedule(value - 1);
      }}
      onCommit={() => {
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
  const { t } = useLingui();
  const idx = createMemo(() => (props.selected ? props.selected.index : -1));

  return (
    <div class="box flex-row items-center gap-2 px-3 py-2 bg-surface border-t border-border">
      <IconButton
        label={t`Previous frame`}
        disabled={idx() <= 0}
        dataSet={{ 'scrub-prev': '' }}
        onClick={() => props.nav.stepFrame(-1)}
      >
        <ChevronLeftIcon />
      </IconButton>
      <IconButton
        label={props.nav.playing() ? t`Pause playback` : t`Play frames`}
        onClick={() => props.nav.togglePlay()}
      >
        <Show when={props.nav.playing()} fallback={<PlayIcon />}>
          <PauseIcon />
        </Show>
      </IconButton>
      <IconButton
        label={t`Next frame`}
        disabled={idx() < 0 || idx() >= props.frames.length - 1}
        dataSet={{ 'scrub-next': '' }}
        onClick={() => props.nav.stepFrame(1)}
      >
        <ChevronRightIcon />
      </IconButton>
      <div class="box flex-1 relative min-w-0">
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
