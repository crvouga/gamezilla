import gsap from 'gsap';
import { useEffect, useMemo, useRef } from 'react';
import type { PlaygroundSim } from '../playground-sim';
import { C, NS, nodeColor } from './constants';

type ClientVm = { id: string; partitioned: boolean };

function clientAnchorPositions(
  count: number,
  vw: number,
  vh: number
): { x: number; y: number }[] {
  const cx = vw / 2;
  const rowY = vh * 0.72;
  if (count <= 0) return [];
  if (count === 1) return [{ x: cx, y: rowY }];
  const maxSpread = vw * 0.72;
  const spread = Math.min(maxSpread, 56 + count * 48);
  const left = cx - spread / 2;
  const step = count > 1 ? spread / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => ({
    x: left + i * step,
    y: rowY,
  }));
}

export function PlaygroundTopologyGraph({
  sim,
  pulseKey,
  linkEpoch,
}: {
  sim: PlaygroundSim;
  pulseKey: number;
  /** Bump when link partition/heal might change so edges re-read state. */
  linkEpoch: number;
}) {
  const serverPos = { x: 240, y: 62 };
  const viewW = 480;
  const viewH = 280;
  const anchors = useMemo(
    () => clientAnchorPositions(sim.clients.length, viewW, viewH),
    [sim.clients.length]
  );

  const clients: ClientVm[] = useMemo(
    () =>
      sim.clients.map((c) => ({
        id: c.id,
        partitioned: c.link.isPartitioned(),
      })),
    [sim, linkEpoch]
  );

  const allIds = useMemo(
    () => ['s:' + sim.serverId, ...clients.map((c) => 'c:' + c.id)],
    [sim.serverId, clients]
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
      className="h-full w-full max-h-full"
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
              y1={serverPos.y + 18}
              x2={ap.x}
              y2={ap.y - 18}
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

      <g transform={`translate(${serverPos.x}, ${serverPos.y})`}>
        <rect
          x={-52}
          y={-22}
          rx={14}
          width={104}
          height={44}
          fill={C.node}
          stroke={C.nodeSelBorder}
          strokeWidth={2}
        />
        <text
          xmlns={NS}
          textAnchor="middle"
          y={6}
          fill={C.textLight}
          fontSize={13}
          fontWeight={700}
          className="font-sans"
        >
          {sim.serverId}
        </text>
        <text
          xmlns={NS}
          textAnchor="middle"
          y={22}
          fill={C.teal}
          fontSize={9}
          fontWeight={600}
          className="font-sans"
        >
          hub
        </text>
      </g>

      {clients.map((c, i) => {
        const ap = anchors[i];
        if (!ap) return null;
        const col = nodeColor(allIds, 'c:' + c.id);
        return (
          <g key={c.id} transform={`translate(${ap.x}, ${ap.y})`}>
            <rect
              x={-44}
              y={-26}
              rx={12}
              width={88}
              height={52}
              fill={C.node}
              stroke={col}
              strokeWidth={c.partitioned ? 2 : 2.4}
            />
            <text
              xmlns={NS}
              textAnchor="middle"
              y={2}
              fill={C.textLight}
              fontSize={12}
              fontWeight={700}
              className="font-sans"
            >
              {c.id}
            </text>
            {c.partitioned ? (
              <text
                xmlns={NS}
                textAnchor="middle"
                y={18}
                fill={C.red}
                fontSize={8}
                fontWeight={700}
                className="font-sans"
              >
                zapped
              </text>
            ) : (
              <text
                xmlns={NS}
                textAnchor="middle"
                y={18}
                fill={C.green}
                fontSize={8}
                fontWeight={600}
                className="font-sans"
              >
                online
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
