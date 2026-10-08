/** @jsxImportSource solid-js */
/**
 * Production-capable performance HUD as a thin top banner (FPS / INP / long
 * tasks). Portals into the in-flow banner host so it pushes app content.
 * Tap to expand secondary metrics; "Hide" turns the preference off.
 */

import type { PerfSnapshot } from '@libs/app-root-shared/types';
import { InFlowBanner } from '@pkgs/ui-root-client/dismissible-top-banner';
import { createSignal, type JSX, Show } from 'solid-js';
import { usePerfHudPreference } from './perf-hud-preference';
import { createPerfSnapshot } from './perf-sampler-context';

type MetricTone = 'good' | 'fair' | 'poor';

function fpsTone(fps: number): MetricTone {
  if (fps >= 58) return 'good';
  if (fps >= 45) return 'fair';
  return 'poor';
}

function MetricChip(props: {
  readonly label: string;
  readonly value: string;
  readonly tone?: MetricTone | undefined;
}): JSX.Element {
  return (
    <div class="box flex-row gap-1 items-baseline shrink-0">
      <p class="text textFootnote">{props.label}</p>
      <p
        class="text textFootnote textNumeral text-text"
        classList={{
          'text-success': props.tone === 'good',
          'text-warning': props.tone === 'fair',
          'text-destructive': props.tone === 'poor',
        }}
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
        {(script) => (
          <p class="text textFootnote line-clamp-2 text-text">{script()}</p>
        )}
      </Show>
      <Show when={props.snap.inpTarget}>
        {(target) => <p class="text textFootnote line-clamp-2">{target()}</p>}
      </Show>
      <button
        class="clickable clickableTint self-start py-0.5"
        data-testid="perf-hud-hide"
        type="button"
        onClick={() => props.onHide()}
        aria-label="Hide performance monitor"
      >
        <p class="text textFootnote text-tint">{'Hide'}</p>
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
        class="box bg-surface-sunken border-b border-border"
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
