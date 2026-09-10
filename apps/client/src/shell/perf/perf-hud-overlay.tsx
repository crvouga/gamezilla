/** @jsxImportSource solid-js */
/**
 * Production-capable performance HUD chip (FPS / INP / long tasks). Tap to
 * expand the secondary metrics; "Hide" turns the preference off.
 */

import { createSignal, type JSX, Show } from 'solid-js';

import { usePerfHudPreference } from './perf-hud-preference';
import { createPerfSnapshot } from './perf-sampler-context';
import type { PerfSnapshot } from './types';

const HUD_TOP = 48;
const HUD_RIGHT = 8;
const HUD_MAX_WIDTH = 220;
const HUD_Z_INDEX = 9999;

function fpsColor(fps: number): string {
  if (fps >= 58) return '#22c55e';
  if (fps >= 45) return '#eab308';
  return '#ef4444';
}

function MetricLine(props: {
  readonly label: string;
  readonly value: string;
  readonly color?: string | undefined;
}): JSX.Element {
  return (
    <div class="box flex-row gap-1 items-baseline">
      <p class="text text-[10px] text-[rgba(255,255,255,0.65)] font-semibold">
        {props.label}
      </p>
      <p
        class="text text-[11px] font-bold"
        style={{ color: props.color ?? '#fff' }}
      >
        {props.value}
      </p>
    </div>
  );
}

function ExpandedMetrics(props: {
  readonly snap: PerfSnapshot;
  readonly onHide: () => void;
}): JSX.Element {
  const heapLabel = () =>
    props.snap.heapMb === null ? '—' : `${String(props.snap.heapMb)}MB`;
  return (
    <div class="box gap-0.5 mt-1">
      <MetricLine label="slow%" value={String(props.snap.slowFramePct)} />
      <MetricLine label="LTn" value={String(props.snap.longTaskCount)} />
      <MetricLine label="heap" value={heapLabel()} />
      <Show when={props.snap.longestScript}>
        {(script) => (
          <p class="text line-clamp-3 text-[9px] text-[rgba(255,255,255,0.8)] mt-0.5">
            {script()}
          </p>
        )}
      </Show>
      <Show when={props.snap.inpTarget}>
        {(target) => (
          <p class="text line-clamp-2 text-[9px] text-[rgba(255,255,255,0.55)]">
            {target()}
          </p>
        )}
      </Show>
      <button
        class="clickable clickableTint mt-1 py-0.5"
        data-testid="perf-hud-hide"
        type="button"
        onClick={() => props.onHide()}
        aria-label="Hide performance monitor"
      >
        <p class="text text-[10px] text-[#93c5fd] font-semibold">{'Hide'}</p>
      </button>
    </div>
  );
}

export function PerfHudOverlay(): JSX.Element {
  const { enabled, setEnabled } = usePerfHudPreference();
  const snap = createPerfSnapshot(enabled);
  const [expanded, setExpanded] = createSignal(false);

  const inpLabel = () =>
    snap().inpMs === null ? '—' : `${String(snap().inpMs)}ms`;
  const maxLtLabel = () =>
    snap().maxLongTaskMs === 0 ? '—' : `${String(snap().maxLongTaskMs)}ms`;

  return (
    <Show when={enabled()}>
      <div
        class="box absolute"
        style={{
          top: `${HUD_TOP}px`,
          right: `${HUD_RIGHT}px`,
          'z-index': HUD_Z_INDEX,
          'max-width': `${HUD_MAX_WIDTH}px`,
        }}
        data-component="PerfHudOverlay"
        data-testid="perf-hud"
      >
        <div class="box bg-[rgba(0,0,0,0.78)] rounded-[8px] px-2 py-1.5 gap-0.5 border border-[rgba(255,255,255,0.15)]">
          <button
            class="clickable gap-0.5 items-stretch"
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-label="Performance monitor"
            aria-expanded={expanded()}
          >
            <MetricLine
              label="FPS"
              value={String(snap().fps)}
              color={fpsColor(snap().fps)}
            />
            <MetricLine label="INP" value={inpLabel()} />
            <MetricLine label="maxLT" value={maxLtLabel()} />
          </button>
          <Show when={expanded()}>
            <ExpandedMetrics snap={snap()} onHide={() => setEnabled(false)} />
          </Show>
        </div>
      </div>
    </Show>
  );
}
