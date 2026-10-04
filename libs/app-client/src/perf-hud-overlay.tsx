/** @jsxImportSource solid-js */
/**
 * Production-capable performance HUD as a thin top banner (FPS / INP / long
 * tasks). Portals into the in-flow banner host so it pushes app content.
 * Tap to expand secondary metrics; "Hide" turns the preference off.
 */

import { InFlowBanner } from '@pkgs/ui-client/dismissible-top-banner';
import { createSignal, type JSX, Show } from 'solid-js';

import { usePerfHudPreference } from './perf-hud-preference';
import { createPerfSnapshot } from './perf-sampler-context';
import type { PerfSnapshot } from '@libs/app-shared/types';

function fpsColor(fps: number): string {
  if (fps >= 58) return '#22c55e';
  if (fps >= 45) return '#eab308';
  return '#ef4444';
}

function MetricChip(props: {
  readonly label: string;
  readonly value: string;
  readonly color?: string | undefined;
}): JSX.Element {
  return (
    <div class="box flex-row gap-1 items-baseline shrink-0">
      <p class="text text-micro text-perf-muted font-semibold uppercase tracking-wide">
        {props.label}
      </p>
      <p
        class="text text-2xs font-bold tabular-nums"
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
    <div class="box gap-1 px-3 pb-2 border-t border-perf-divider">
      <div class="box flex-row flex-wrap gap-x-3 gap-y-0.5 pt-1.5">
        <MetricChip label="slow%" value={String(props.snap.slowFramePct)} />
        <MetricChip label="LTn" value={String(props.snap.longTaskCount)} />
        <MetricChip label="heap" value={heapLabel()} />
      </div>
      <Show when={props.snap.longestScript}>
        {(script) => (
          <p class="text line-clamp-2 text-nano text-perf-text">{script()}</p>
        )}
      </Show>
      <Show when={props.snap.inpTarget}>
        {(target) => (
          <p class="text line-clamp-2 text-nano text-perf-muted">{target()}</p>
        )}
      </Show>
      <button
        class="clickable clickableTint self-start py-0.5"
        data-testid="perf-hud-hide"
        type="button"
        onClick={() => props.onHide()}
        aria-label="Hide performance monitor"
      >
        <p class="text text-micro text-perf-accent font-semibold">{'Hide'}</p>
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
    <InFlowBanner position="top" visible={enabled()}>
      <div
        class="box bg-perf-background border-b border-perf-border"
        style={{ 'padding-top': 'env(safe-area-inset-top, 0px)' }}
        data-component="PerfHudOverlay"
        data-testid="perf-hud"
      >
        <button
          class="clickable flex-row items-center gap-3 px-3 py-1 w-full"
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label="Performance monitor"
          aria-expanded={expanded()}
        >
          <MetricChip
            label="FPS"
            value={String(snap().fps)}
            color={fpsColor(snap().fps)}
          />
          <MetricChip label="INP" value={inpLabel()} />
          <MetricChip label="maxLT" value={maxLtLabel()} />
        </button>
        <Show when={expanded()}>
          <ExpandedMetrics snap={snap()} onHide={() => setEnabled(false)} />
        </Show>
      </div>
    </InFlowBanner>
  );
}
