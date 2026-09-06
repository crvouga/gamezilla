/**
 * Pulses a colored ring around children when the attributed seq advances.
 * Animates ring opacity (not border color).
 */

import { useTimers } from '@pkgs/clock';
import type { AttributionHit, ParticipantColor } from '@pkgs/collab';
import {
  Box,
  type ComponentDataSet,
  componentDataSet,
  type SxProps,
} from '@pkgs/ui-rn';
import type { ReactElement, ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

export type AttributionHighlightProps = {
  /** Current attribution for this surface; null = no ring. */
  hit: AttributionHit | null;
  colorForActor: (actorId: string) => ParticipantColor | string;
  children: ReactNode;
  borderRadius?: number;
  borderWidth?: number;
  dataSet?: ComponentDataSet;
};

function resolveColor(
  colorForActor: AttributionHighlightProps['colorForActor'],
  actorId: string
): string {
  const c = colorForActor(actorId);
  return typeof c === 'string' ? c : c.css;
}

const PULSE_MS = 1200;

function webOpacityTransition(): SxProps | undefined {
  if (Platform.OS !== 'web') return undefined;
  return {
    transitionProperty: 'opacity',
    transitionDuration: '1.2s',
  };
}

function useAttributionPulse(hitSeq: number | null): {
  pulseSeq: number | null;
  ringOn: boolean;
} {
  const timers = useTimers();
  const lastSeq = useRef<number | null>(null);
  const [pulseSeq, setPulseSeq] = useState<number | null>(null);
  const [ringOn, setRingOn] = useState(false);

  useEffect(() => {
    if (hitSeq === null) {
      lastSeq.current = null;
      setPulseSeq((prev) => (prev === null ? prev : null));
      setRingOn((prev) => (prev ? false : prev));
      return;
    }
    if (lastSeq.current === hitSeq) return;
    lastSeq.current = hitSeq;
    setPulseSeq(hitSeq);
    setRingOn(true);
    const t = timers.setTimeout(() => setRingOn(false), PULSE_MS);
    return () => {
      timers.clearTimeout(t);
    };
  }, [hitSeq, timers]);

  return { pulseSeq, ringOn };
}

function AttributionRing(props: {
  color: string;
  ringOn: boolean;
  borderRadius: number;
  borderWidth: number;
}): ReactElement {
  const { color, ringOn, borderRadius, borderWidth } = props;
  return (
    <Box
      pointerEvents="none"
      sx={[
        {
          absoluteFill: true,
          borderRadius,
          borderWidth,
          borderColor: color,
          opacity: ringOn ? 1 : 0,
        },
        webOpacityTransition(),
      ]}
    />
  );
}

function resolveRingColor(args: {
  actorId: string | null;
  pulseSeq: number | null;
  colorForActor: AttributionHighlightProps['colorForActor'];
}): string | null {
  if (args.actorId === null || args.pulseSeq === null) return null;
  return resolveColor(args.colorForActor, args.actorId);
}

/**
 * Web uses a CSS opacity transition. Native flips opacity via state + timeout.
 * Avoids RN Animated under GamesMainMenu (useNativeDriver:false nested
 * setStates were hitting max update depth on web).
 */
export function AttributionHighlight({
  hit,
  colorForActor,
  children,
  borderRadius = 8,
  borderWidth = 2,
  dataSet,
}: AttributionHighlightProps): ReactElement {
  const hitSeq = hit?.seq ?? null;
  const actorId = hit?.actor.id ?? null;
  const { pulseSeq, ringOn } = useAttributionPulse(hitSeq);
  const ringColor = resolveRingColor({ actorId, pulseSeq, colorForActor });

  return (
    <Box
      {...componentDataSet('AttributionHighlight', dataSet)}
      sx={{ position: 'relative' }}
    >
      {children}
      {ringColor !== null ? (
        <AttributionRing
          color={ringColor}
          ringOn={ringOn}
          borderRadius={borderRadius}
          borderWidth={borderWidth}
        />
      ) : null}
    </Box>
  );
}
