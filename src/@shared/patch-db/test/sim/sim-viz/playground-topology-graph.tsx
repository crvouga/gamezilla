import { default as gsap } from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import type { PlaygroundSim } from '../playground-sim';
import { C } from './constants';
import {
  PLAYGROUND_GRAPH_VIEW_H,
  PLAYGROUND_GRAPH_VIEW_W,
  playgroundGraphClientAnchors,
  playgroundGraphServerAnchor,
} from './playground-graph-layout';

type ClientVm = { id: string; partitioned: boolean };

export function PlaygroundTopologyGraph({
  sim,
  pulseKey,
  linkEpoch,
}: {
  sim: PlaygroundSim;
  pulseKey: number;
  linkEpoch: number;
}) {
  const serverPos = playgroundGraphServerAnchor;
  const viewW = PLAYGROUND_GRAPH_VIEW_W;
  const viewH = PLAYGROUND_GRAPH_VIEW_H;
  const anchors = useMemo(
    () => playgroundGraphClientAnchors(sim.clients.length),
    [sim.clients.length]
  );

  const clients: ClientVm[] = useMemo(
    () =>
      sim.clients.map((c) => ({
        id: c.id,
        partitioned: c.link.isPartitioned(),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim, linkEpoch]
  );

  const edgesRef = useRef<(SVGLineElement | null)[]>([]);

  useEffect(() => {
    const lines = edgesRef.current.filter(Boolean);
    if (lines.length === 0) return;
    gsap.killTweensOf(lines);
    gsap.fromTo(
      lines,
      { strokeOpacity: 0.35 },
      { strokeOpacity: 1, duration: 0.35, ease: 'power2.out', stagger: 0.04 }
    );
  }, [pulseKey]);

  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="pgGlow" cx="50%" cy="35%" r="65%">
          <stop offset="0%" stopColor={C.violet} stopOpacity="0.28" />
          <stop offset="100%" stopColor={C.bg} stopOpacity="0" />
        </radialGradient>
        <filter id="pgSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1.2" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <rect width={viewW} height={viewH} fill="url(#pgGlow)" />
      <g filter="url(#pgSoft)">
        {clients.map((c, i) => {
          const ap = anchors[i];
          if (!ap) return null;
          const partition = c.partitioned;
          return (
            <line
              key={`e-${c.id}`}
              ref={(el) => {
                edgesRef.current[i] = el;
              }}
              x1={serverPos.x}
              y1={serverPos.y}
              x2={ap.x}
              y2={ap.y}
              stroke={partition ? C.red : C.teal}
              strokeWidth={partition ? 2.2 : 2.6}
              strokeDasharray={partition ? '4 6' : '6 5'}
              strokeLinecap="round"
              className={partition ? 'edge-dead' : 'edge-live'}
              opacity={0.95}
            />
          );
        })}
      </g>

      <circle cx={serverPos.x} cy={serverPos.y} r={9} fill={C.node} stroke={C.nodeSelBorder} strokeWidth={2} />
      {clients.map((c, i) => {
        const ap = anchors[i];
        if (!ap) return null;
        return (
          <circle
            key={`n-${c.id}`}
            cx={ap.x}
            cy={ap.y}
            r={8}
            fill={C.node}
            stroke={c.partitioned ? C.red : C.teal}
            strokeWidth={2}
          />
        );
      })}
    </svg>
  );
}
