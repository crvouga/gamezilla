/**
 * Production-capable performance HUD chip (FPS / INP / long tasks).
 * Uses sx only — no RN style prop.
 */

import { Box, Pressable, Text } from '@pkgs/ui-rn';
import { type ReactNode, startTransition, useEffect, useState } from 'react';

import { usePerfHudPreference } from './perf-hud-preference';
import { usePerfSampler } from './perf-sampler-context';
import { EMPTY_PERF_SNAPSHOT, type PerfSnapshot } from './types';

function fpsColor(fps: number): string {
  if (fps >= 58) return '#22c55e';
  if (fps >= 45) return '#eab308';
  return '#ef4444';
}

function MetricLine({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}): ReactNode {
  return (
    <Box sx={{ flexDirection: 'row', gap: 1, alignItems: 'baseline' }}>
      <Text
        sx={{
          fontSize: 10,
          color: 'rgba(255,255,255,0.65)',
          fontWeight: '600',
        }}
        label={label}
      />
      <Text
        sx={{
          fontSize: 11,
          fontWeight: '700',
          color: color ?? '#fff',
          fontVariant: ['tabular-nums'],
        }}
        label={value}
      />
    </Box>
  );
}

export function PerfHudOverlay(): ReactNode {
  const { enabled, setEnabled } = usePerfHudPreference();
  const sampler = usePerfSampler();
  const [snap, setSnap] = useState<PerfSnapshot>(EMPTY_PERF_SNAPSHOT);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!enabled) return undefined;
    return sampler.subscribe((next) => {
      // HUD must not compete with INP — defer paint to a transition.
      startTransition(() => {
        setSnap(next);
      });
    });
  }, [enabled, sampler]);

  if (!enabled) return null;

  const inpLabel = snap.inpMs === null ? '—' : `${snap.inpMs}ms`;
  const maxLtLabel = snap.maxLongTaskMs === 0 ? '—' : `${snap.maxLongTaskMs}ms`;
  const heapLabel = snap.heapMb === null ? '—' : `${snap.heapMb}MB`;

  return (
    <Box
      pointerEvents="box-none"
      sx={{
        position: 'absolute',
        top: 48,
        right: 8,
        zIndex: 9999,
        maxWidth: 220,
      }}
    >
      <Pressable
        onPress={() => setExpanded((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel="Performance monitor"
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
        <MetricLine
          label="FPS"
          value={String(snap.fps)}
          color={fpsColor(snap.fps)}
        />
        <MetricLine label="INP" value={inpLabel} />
        <MetricLine label="maxLT" value={maxLtLabel} />
        {expanded ? (
          <Box sx={{ gap: 0.5, mt: 1 }}>
            <MetricLine label="slow%" value={`${snap.slowFramePct}`} />
            <MetricLine label="LTn" value={String(snap.longTaskCount)} />
            <MetricLine label="heap" value={heapLabel} />
            {snap.longestScript !== null ? (
              <Text
                sx={{
                  fontSize: 9,
                  color: 'rgba(255,255,255,0.8)',
                  mt: 0.5,
                }}
                numberOfLines={3}
                label={snap.longestScript}
              />
            ) : null}
            {snap.inpTarget !== null ? (
              <Text
                sx={{ fontSize: 9, color: 'rgba(255,255,255,0.55)' }}
                numberOfLines={2}
                label={snap.inpTarget}
              />
            ) : null}
            <Pressable
              onPress={() => setEnabled(false)}
              accessibilityRole="button"
              accessibilityLabel="Hide performance monitor"
              sx={{ mt: 1, py: 0.5 }}
            >
              <Text
                sx={{ fontSize: 10, color: '#93c5fd', fontWeight: '600' }}
                label="Hide"
              />
            </Pressable>
          </Box>
        ) : null}
      </Pressable>
    </Box>
  );
}
