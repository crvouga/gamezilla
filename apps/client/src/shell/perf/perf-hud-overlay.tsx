/** @jsxImportSource solid-js */
/**
 * Production-capable performance HUD as a thin top banner (FPS / INP / long
 * tasks). Portals into the in-flow banner host so it pushes app content.
 * Tap to expand secondary metrics; "Hide" turns the preference off.
 */

import { InFlowBanner } from '@pkgs/ui';
import { createSignal, type JSX, Show } from 'solid-js';

import { usePerfHudPreference } from './perf-hud-preference';
import { createPerfSnapshot } from './perf-sampler-context';
import type { PerfSnapshot } from './types';

function fpsTone(fps: number): string {
  if (fps >= 58) return 'text-success';
  if (fps >= 45) return 'text-warning';
  return 'text-destructive';
}

function MetricChip(props: {
  readonly label: string;
  readonly value: string;
  readonly tone?: string | undefined;
}): JSX.Element {
  return (
    <div class="box flex-row gap-1 items-baseline shrink-0">
      <p class="text textCaption font-semibold uppercase tracking-wide">
        {props.label}
      </p>
      <p
        class={`text textCaption font-bold tabular-nums ${props.tone ?? 'text-text'}`}
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
    <div class="box gap-1 px-3 pb-2 border-t border-border">
      <div class="box flex-row flex-wrap gap-x-3 gap-y-0.5 pt-1.5">
        <MetricChip label="slow%" value={String(props.snap.slowFramePct)} />
        <MetricChip label="LTn" value={String(props.snap.longTaskCount)} />
        <MetricChip label="heap" value={heapLabel()} />
      </div>
      <Show when={props.snap.longestScript}>
        {(script) => <p class="text textCaption line-clamp-2">{script()}</p>}
      </Show>
      <Show when={props.snap.inpTarget}>
        {(target) => (
          <p class="text textCaption line-clamp-2 text-text-secondary">
            {target()}
          </p>
        )}
      </Show>
      <button
        class="clickable clickableTint self-start py-0.5"
        data-testid="perf-hud-hide"
        type="button"
        onClick={() => props.onHide()}
        aria-label="Hide performance monitor"
      >
        <p class="text textCaption text-tint font-semibold">{'Hide'}</p>
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
        class="box bg-scrim border-b border-border safeTop"
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
            tone={fpsTone(snap().fps)}
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
