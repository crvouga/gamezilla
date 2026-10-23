/** @jsxImportSource solid-js */
/**
 * Production-capable performance HUD as a thin top banner (FPS / INP / long
 * tasks). Portals into the in-flow banner host so it pushes app content.
 * Tap to expand secondary metrics; "Hide" turns the preference off.
 */

import type { PerfSnapshot } from '@libs/app-root-shared-ts/types';
import { InFlowBanner } from '@pkgs/ui-root-client-ts/dismissible-top-banner';
import { Divider } from '@pkgs/ui-root-client-ts/divider';
import { Pressable } from '@pkgs/ui-root-client-ts/pressable';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { ColorTone } from '@pkgs/ui-root-shared-ts/token-names';
import { createSignal, type JSX, Show } from 'solid-js';
import { usePerfHudPreference } from './perf-hud-preference';
import { createPerfSnapshot } from './perf-sampler-context';

type MetricTone = 'good' | 'fair' | 'poor';

const TONE: Readonly<Record<MetricTone, ColorTone>> = {
  good: 'success',
  fair: 'warning',
  poor: 'destructive',
};

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
    <StackHorizontal gap="xs" align="baseline">
      <P variant="footnote">{props.label}</P>
      <P
        variant="footnote"
        numeral
        tone={props.tone === undefined ? 'default' : TONE[props.tone]}
      >
        {props.value}
      </P>
    </StackHorizontal>
  );
}

function ExpandedMetrics(props: {
  readonly snap: PerfSnapshot;
  readonly onHide: () => void;
}): JSX.Element {
  const heapLabel = () =>
    props.snap.heapMb === null ? '—' : `${String(props.snap.heapMb)}MB`;
  return (
    <StackVertical>
      <Divider />
      <StackVertical gap="xs" paddingX="md" paddingTop="sm" paddingBottom="sm">
        <StackHorizontal wrap gap="sm">
          <MetricChip label="slow%" value={String(props.snap.slowFramePct)} />
          <MetricChip label="LTn" value={String(props.snap.longTaskCount)} />
          <MetricChip label="heap" value={heapLabel()} />
        </StackHorizontal>
        <Show when={props.snap.longestScript}>
          {(script) => (
            <P variant="footnote" tone="default" lines={2}>
              {script()}
            </P>
          )}
        </Show>
        <Show when={props.snap.inpTarget}>
          {(target) => (
            <P variant="footnote" lines={2}>
              {target()}
            </P>
          )}
        </Show>
        <Pressable
          self="start"
          paddingY="xs"
          testId="perf-hud-hide"
          onPress={() => props.onHide()}
          aria-label="Hide performance monitor"
        >
          <P variant="footnote" tone="tint">
            {'Hide'}
          </P>
        </Pressable>
      </StackVertical>
    </StackVertical>
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
    <InFlowBanner
      position="top"
      visible={enabled()}
      sheet="paper"
      testId="perf-hud"
    >
      <Pressable
        tint={false}
        direction="horizontal"
        align="center"
        gap="md"
        paddingX="md"
        paddingY="xs"
        width="full"
        onPress={() => setExpanded((v) => !v)}
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
      </Pressable>
      <Show when={expanded()}>
        <ExpandedMetrics snap={snap()} onHide={() => setEnabled(false)} />
      </Show>
    </InFlowBanner>
  );
}
