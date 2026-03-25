import type { SimTopology, Layout, Point, EdgeGeo } from './types';

export function buildLayout(topo: SimTopology, W: number, H: number): Layout {
  const srvY = 90,
    cliY = H - 90;
  const pos: Record<string, Point> = {};
  const links: Layout['links'] = [];
  const bySrv: Record<string, SimTopology['clients']> = {};

  for (const c of topo.clients) (bySrv[c.serverId] ||= []).push(c);

  const nS = topo.servers.length,
    pad = 140,
    inner = W - 2 * pad;

  topo.servers.forEach((s, i) => {
    pos['s:' + s.id] = {
      x: nS <= 1 ? W / 2 : pad + (inner * i) / Math.max(nS - 1, 1),
      y: srvY,
    };
  });

  topo.clients.forEach((c) => {
    const list = bySrv[c.serverId] || [c],
      ci = list.indexOf(c),
      n = list.length;
    const sx = pos['s:' + c.serverId]?.x ?? W / 2;
    const spread = Math.min(180, inner / Math.max(nS * 2, 1));
    pos['c:' + c.id] = { x: sx + (ci - (n - 1) / 2) * spread, y: cliY };
    links.push({ s: 's:' + c.serverId, c: 'c:' + c.id, clientId: c.id });
  });

  return { pos, links, W, H };
}

export function edgeGeo(a: Point, b: Point): EdgeGeo {
  const mx = (a.x + b.x) / 2,
    my = (a.y + b.y) / 2;
  const bend = Math.abs(b.y - a.y) < 8 ? 0 : (b.y - a.y) * 0.3;
  const cx = mx,
    cy = my - bend;
  return {
    d: `M${a.x},${a.y} Q${cx},${cy} ${b.x},${b.y}`,
    ctrl: { x: cx, y: cy },
    mid: {
      x: 0.25 * a.x + 0.5 * cx + 0.25 * b.x,
      y: 0.25 * a.y + 0.5 * cy + 0.25 * b.y,
    },
  };
}

export function bezPt(a: Point, c: Point, b: Point, t: number): Point {
  const u = 1 - t;
  return {
    x: u * u * a.x + 2 * u * t * c.x + t * t * b.x,
    y: u * u * a.y + 2 * u * t * c.y + t * t * b.y,
  };
}
