/** @jsxImportSource solid-js */
/**
 * Production-capable performance HUD chip (FPS / INP / long tasks). Tap to
 * expand the secondary metrics; "Hide" turns the preference off.
 */

import { Box, Clickable, Text } from '@pkgs/ui';
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
    <Box sx={{ flexDirection: 'row', gap: 1, alignItems: 'baseline' }}>
      <Text
        sx={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.65)',
          fontWeight: '600',
        }}
        label={props.label}
      />
      <Text
        sx={{
          fontSize: 11,
          fontWeight: '700',
          color: props.color ?? '#fff',
          fontVariant: ['tabular-nums'],
        }}
        label={props.value}
      />
    </Box>
  );
}

function ExpandedMetrics(props: {
  readonly snap: PerfSnapshot;
  readonly onHide: () => void;
}): JSX.Element {
  const heapLabel = () =>
    props.snap.heapMb === null ? '—' : `${String(props.snap.heapMb)}MB`;
  return (
    <Box sx={{ gap: 0.5, mt: 1 }}>
      <MetricLine label="slow%" value={String(props.snap.slowFramePct)} />
      <MetricLine label="LTn" value={String(props.snap.longTaskCount)} />
      <MetricLine label="heap" value={heapLabel()} />
      <Show when={props.snap.longestScript}>
        {(script) => (
          <Text
            sx={{ fontSize: 9, color: 'rgba(255,255,255,0.8)', mt: 0.5 }}
            numberOfLines={3}
            label={script()}
          />
        )}
      </Show>
      <Show when={props.snap.inpTarget}>
        {(target) => (
          <Text
            sx={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}
            numberOfLines={2}
            label={target()}
          />
        )}
      </Show>
      <Clickable
        onClick={() => props.onHide()}
        aria-label="Hide performance monitor"
        sx={{ mt: 1, py: 0.5 }}
        dataSet={{ testid: 'perf-hud-hide' }}
      >
        <Text
          sx={{ fontSize: 10, color: '#93c5fd', fontWeight: '600' }}
          label="Hide"
        />
      </Clickable>
    </Box>
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
      <Box
        sx={{
          position: 'absolute',
          top: HUD_TOP,
          right: HUD_RIGHT,
          zIndex: HUD_Z_INDEX,
          maxWidth: HUD_MAX_WIDTH,
        }}
        dataSet={{ component: 'PerfHudOverlay', testid: 'perf-hud' }}
      >
        <Box
          sx={{
            backgroundColor: 'rgba(0,0,0,0.78)',
            borderRadius: 8,
            px: 2,
            py: 1.5,
            gap: 0.5,
            borderWidth: 1,
            borderColor: 'rgba(255,255,255,0.15)',
          }}
        >
          <Clickable
            onClick={() => setExpanded((v) => !v)}
            aria-label="Performance monitor"
            aria-expanded={expanded()}
            feedback="none"
            sx={{ gap: 0.5, alignItems: 'stretch' }}
          >
            <MetricLine
              label="FPS"
              value={String(snap().fps)}
              color={fpsColor(snap().fps)}
            />
            <MetricLine label="INP" value={inpLabel()} />
            <MetricLine label="maxLT" value={maxLtLabel()} />
          </Clickable>
          <Show when={expanded()}>
            <ExpandedMetrics snap={snap()} onHide={() => setEnabled(false)} />
          </Show>
        </Box>
      </Box>
    </Show>
  );
}
