import { default as gsap } from 'gsap';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
} from 'react';
import type { PlaygroundSim } from '../patch-db/sim/playground-sim';
import { C, SERVER_NODE_ID } from './constants';
import {
  PLAYGROUND_GRAPH_VIEW_H,
  PLAYGROUND_GRAPH_VIEW_W,
  playgroundGraphClientAnchors,
  playgroundGraphServerAnchor,
} from './playground-graph-layout';

type ClientVm = {
  id: string;
  partitioned: boolean;
  serverPartitioned: boolean;
};

export type TopoAnimHandle = {
  /** @param durationMs Travel time for the dot. Defaults to 150ms minimum. */
  animateMessage(
    fromNodeId: string,
    toNodeId: string,
    durationMs?: number
  ): void;
};

/**
 * Server icon: a tiny rack/tower icon in a 24x24 viewBox.
 * Rendered at the server anchor position.
 */
function ServerIcon({
  x,
  y,
  partitioned,
}: {
  x: number;
  y: number;
  partitioned: boolean;
}) {
  const accent = partitioned ? C.red : C.violet;
  const indicator = partitioned ? C.red : C.green;
  return (
    <g transform={`translate(${x - 16}, ${y - 18})`}>
      <rect
        x={4}
        y={2}
        width={24}
        height={32}
        rx={3}
        fill={C.node}
        stroke={partitioned ? C.red : C.nodeSelBorder}
        strokeWidth={1.5}
      />
      <rect
        x={8}
        y={6}
        width={16}
        height={4}
        rx={1}
        fill={accent}
        opacity={0.7}
      />
      <circle cx={22} cy={8} r={1} fill={indicator} />
      <rect
        x={8}
        y={13}
        width={16}
        height={4}
        rx={1}
        fill={accent}
        opacity={0.5}
      />
      <circle cx={22} cy={15} r={1} fill={indicator} />
      <rect
        x={8}
        y={20}
        width={16}
        height={4}
        rx={1}
        fill={accent}
        opacity={0.35}
      />
      <circle cx={22} cy={22} r={1} fill={partitioned ? C.dimRed : C.teal} />
      <rect x={12} y={28} width={8} height={3} rx={1} fill={C.nodeBorder} />
      {partitioned && (
        <line
          x1={6}
          y1={4}
          x2={26}
          y2={30}
          stroke={C.red}
          strokeWidth={1.8}
          opacity={0.7}
        />
      )}
    </g>
  );
}

/**
 * Client icon: a laptop/monitor icon.
 */
function ClientIcon({
  x,
  y,
  partitioned,
}: {
  x: number;
  y: number;
  partitioned: boolean;
}) {
  const accent = partitioned ? C.red : C.teal;
  return (
    <g transform={`translate(${x - 14}, ${y - 12})`}>
      <rect
        x={2}
        y={1}
        width={24}
        height={16}
        rx={2}
        fill={C.node}
        stroke={accent}
        strokeWidth={1.4}
      />
      <rect
        x={5}
        y={4}
        width={18}
        height={10}
        rx={1}
        fill={accent}
        opacity={0.18}
      />
      <rect x={6} y={19} width={16} height={2} rx={1} fill={C.nodeBorder} />
      {partitioned && (
        <line
          x1={4}
          y1={2}
          x2={24}
          y2={16}
          stroke={C.red}
          strokeWidth={1.6}
          opacity={0.7}
        />
      )}
    </g>
  );
}

export const PlaygroundTopologyGraph = forwardRef<
  TopoAnimHandle,
  {
    sim: PlaygroundSim;
    pulseKey: number;
    linkEpoch: number;
  }
>(function PlaygroundTopologyGraph({ sim, pulseKey, linkEpoch }, ref) {
  const serverPos = playgroundGraphServerAnchor;
  const viewW = PLAYGROUND_GRAPH_VIEW_W;
  const viewH = PLAYGROUND_GRAPH_VIEW_H;
  const anchors = useMemo(
    () => playgroundGraphClientAnchors(sim.clients.length),
    [sim.clients.length]
  );

  const serverPartitioned = sim.isServerPartitioned();
  const clients: ClientVm[] = useMemo(
    () =>
      sim.clients.map((c) => ({
        id: c.id,
        partitioned: c.link.isPartitioned(),
        serverPartitioned,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sim, linkEpoch, serverPartitioned]
  );

  const edgesRef = useRef<(SVGLineElement | null)[]>([]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const particlesRef = useRef<SVGGElement | null>(null);

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

  const nodePosition = useCallback(
    (nodeId: string): { x: number; y: number } | null => {
      if (nodeId === SERVER_NODE_ID) return serverPos;
      const idx = sim.clients.findIndex((c) => c.id === nodeId);
      return idx >= 0 ? (anchors[idx] ?? null) : null;
    },
    [sim.clients, anchors, serverPos]
  );

  const animateMessage = useCallback(
    (fromNodeId: string, toNodeId: string, durationMs?: number) => {
      const fromPos = nodePosition(fromNodeId);
      const toPos = nodePosition(toNodeId);
      if (!fromPos || !toPos || !particlesRef.current) return;

      const travelSec = Math.max(durationMs ?? 0, 150) / 1000;

      const ns = 'http://www.w3.org/2000/svg';
      const dot = document.createElementNS(ns, 'circle');
      dot.setAttribute('r', '4');
      dot.setAttribute('fill', C.yellow);
      dot.setAttribute('cx', String(fromPos.x));
      dot.setAttribute('cy', String(fromPos.y));
      dot.setAttribute('opacity', '0');
      particlesRef.current.appendChild(dot);

      gsap.fromTo(
        dot,
        { attr: { cx: fromPos.x, cy: fromPos.y }, opacity: 0 },
        {
          attr: { cx: toPos.x, cy: toPos.y },
          opacity: 1,
          duration: travelSec,
          ease: 'power2.inOut',
          onComplete: () => {
            gsap.to(dot, {
              opacity: 0,
              attr: { r: 8 },
              duration: 0.2,
              onComplete: () => dot.remove(),
            });
          },
        }
      );
    },
    [nodePosition]
  );

  useImperativeHandle(
    ref,
    () => ({
      animateMessage,
    }),
    [animateMessage]
  );

  return (
    <svg
      ref={svgRef}
      className="pointer-events-none h-full w-full"
      viewBox={`0 0 ${viewW} ${viewH}`}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <radialGradient id="pgGlow" cx="50%" cy="25%" r="70%">
          <stop offset="0%" stopColor={C.violet} stopOpacity="0.22" />
          <stop offset="100%" stopColor={C.bg} stopOpacity="0" />
        </radialGradient>
        <filter id="pgSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1" result="b" />
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
          const broken = c.partitioned || c.serverPartitioned;
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
              stroke={broken ? C.red : C.teal}
              strokeWidth={broken ? 1.8 : 2.2}
              strokeLinecap="round"
              strokeDasharray={c.serverPartitioned ? '6 4' : 'none'}
              className={broken ? 'edge-dead' : 'edge-live'}
              opacity={0.9}
            />
          );
        })}
      </g>

      <ServerIcon
        x={serverPos.x}
        y={serverPos.y}
        partitioned={serverPartitioned}
      />
      <text
        x={serverPos.x}
        y={serverPos.y + 24}
        textAnchor="middle"
        fill={serverPartitioned ? C.red : C.textLight}
        fontSize={9}
        fontFamily="var(--font-mono)"
        fontWeight={600}
      >
        {sim.serverId}
      </text>

      {clients.map((c, i) => {
        const ap = anchors[i];
        if (!ap) return null;
        return (
          <g key={`n-${c.id}`}>
            <ClientIcon x={ap.x} y={ap.y} partitioned={c.partitioned} />
            <text
              x={ap.x}
              y={ap.y + 20}
              textAnchor="middle"
              fill={c.partitioned ? C.red : C.textLight}
              fontSize={8.5}
              fontFamily="var(--font-mono)"
              fontWeight={500}
            >
              {c.id}
            </text>
          </g>
        );
      })}

      <g ref={particlesRef} />
    </svg>
  );
});
