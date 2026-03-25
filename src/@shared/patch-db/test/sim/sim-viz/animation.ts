import { assert } from '@/@shared/assert';
import { C, NS } from './constants';
import { bezPt, edgeGeo } from './layout';
import type { Layout, Point, SimEvent, SimTopology } from './types';

function requireClientId(ev: SimEvent): string {
  const id = ev.clientId;
  assert.defined(id, 'sim viz animation: event missing clientId', {
    type: ev.type,
    seq: ev.seq,
  });
  return id;
}

function requireServerId(ev: SimEvent): string {
  const id = ev.serverId;
  assert.defined(id, 'sim viz animation: event missing serverId', {
    type: ev.type,
    seq: ev.seq,
  });
  return id;
}

/* ── data-aware packet sizing ── */

function dataMagnitude(ev: SimEvent) {
  switch (ev.type) {
    case 'client_write':
    case 'server_write':
      return {
        count: ev.patchCount || 1,
        weight: (ev.summaries || []).reduce(
          (s, x) => s + (x.attributeKeys?.length || 1),
          0
        ),
      };
    case 'remote_write':
      return {
        count: ev.returnedPatchCount || 1,
        weight: (ev.summaries || []).reduce(
          (s, x) => s + (x.attributeKeys?.length || 1),
          0
        ),
      };
    case 'remote_read': {
      const r = ev.results || [];
      const cnt = r.reduce((s, x) => s + x.entityCount, 0);
      const w = r.reduce((s, x) => s + x.patchCount, 0);
      return { count: cnt || 1, weight: w || 1 };
    }
    default:
      return { count: 1, weight: 1 };
  }
}

function pktParams(ev: SimEvent) {
  const m = dataMagnitude(ev);
  return {
    dots: Math.max(2, Math.min(8, m.count)),
    baseR: Math.max(3, Math.min(7, 2.5 + m.weight * 0.4)),
  };
}

/* ── SVG element helpers ── */

function svgEl(
  parent: Element,
  tag: string,
  attrs: Record<string, string | number>
) {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  parent.appendChild(el);
  return el;
}

/* ── GSAP micro-animations ── */

function ring(
  tl: GsapTimeline,
  layer: Element,
  x: number,
  y: number,
  color: string,
  r0: number,
  r1: number,
  delay: number,
  dur: number
) {
  const c = svgEl(layer, 'circle', {
    cx: x,
    cy: y,
    r: r0,
    fill: 'none',
    stroke: color,
    'stroke-width': 2.5,
    opacity: 0,
  });
  tl.fromTo(
    c,
    { attr: { r: r0, opacity: 0.85, 'stroke-width': 2.5 } },
    {
      attr: { r: r1, opacity: 0, 'stroke-width': 0.3 },
      duration: dur,
      ease: 'power2.out',
      onComplete: () => c.remove(),
    },
    delay
  );
}

function lbl(
  tl: GsapTimeline,
  layer: Element,
  x: number,
  y: number,
  text: string,
  color: string,
  delay: number
) {
  const t = svgEl(layer, 'text', {
    x,
    y,
    'text-anchor': 'middle',
    fill: color,
    stroke: C.bg,
    'stroke-width': 4,
    'paint-order': 'stroke',
    'font-size': 11,
    'font-weight': 500,
    'font-family': "'Inter', system-ui",
    opacity: 0,
  });
  t.textContent = text;
  tl.fromTo(
    t,
    { attr: { opacity: 0, y: y + 3 } },
    { attr: { opacity: 1, y }, duration: 0.18, ease: 'power2.out' },
    delay
  );
  tl.to(
    t,
    {
      attr: { opacity: 0, y: y - 5 },
      duration: 0.16,
      onComplete: () => t.remove(),
    },
    delay + 0.32
  );
}

function edgeFlash(
  tl: GsapTimeline,
  layer: Element,
  d: string,
  color: string,
  delay: number,
  dur: number
) {
  const p = svgEl(layer, 'path', {
    d,
    fill: 'none',
    stroke: color,
    'stroke-width': 4,
    'stroke-linecap': 'round',
    opacity: 0,
  });
  tl.fromTo(
    p,
    { attr: { opacity: 0.6 } },
    {
      attr: { opacity: 0 },
      duration: dur,
      ease: 'power1.out',
      onComplete: () => p.remove(),
    },
    delay
  );
}

function pkts(
  tl: GsapTimeline,
  layer: Element,
  from: Point,
  ctrl: Point,
  to: Point,
  color: string,
  n: number,
  baseR: number,
  delay: number,
  dur: number
) {
  for (let i = 0; i < n; i++) {
    const r = Math.max(2, baseR - i * 0.4);
    const dot = svgEl(layer, 'circle', {
      cx: from.x,
      cy: from.y,
      r,
      fill: color,
      opacity: 0,
    });
    const glow = svgEl(layer, 'circle', {
      cx: from.x,
      cy: from.y,
      r: r * 2,
      fill: color,
      opacity: 0,
    });
    const proxy = { t: 0 },
      d0 = delay + i * 0.055;
    tl.to(
      proxy,
      {
        t: 1,
        duration: dur,
        ease: 'power1.inOut',
        onStart() {
          dot.setAttribute('opacity', '0.92');
          glow.setAttribute('opacity', '0.14');
        },
        onUpdate() {
          const p = bezPt(from, ctrl, to, proxy.t);
          dot.setAttribute('cx', String(p.x));
          dot.setAttribute('cy', String(p.y));
          glow.setAttribute('cx', String(p.x));
          glow.setAttribute('cy', String(p.y));
        },
        onComplete() {
          dot.remove();
          glow.remove();
        },
      },
      d0
    );
  }
}

function xMk(
  tl: GsapTimeline,
  layer: Element,
  x: number,
  y: number,
  delay: number
) {
  const a = svgEl(layer, 'line', {
    x1: x - 7,
    y1: y - 7,
    x2: x + 7,
    y2: y + 7,
    stroke: C.red,
    'stroke-width': 2,
    'stroke-linecap': 'round',
    opacity: 0,
  });
  const b = svgEl(layer, 'line', {
    x1: x + 7,
    y1: y - 7,
    x2: x - 7,
    y2: y + 7,
    stroke: C.red,
    'stroke-width': 2,
    'stroke-linecap': 'round',
    opacity: 0,
  });
  tl.to([a, b], { attr: { opacity: 1 }, duration: 0.1 }, delay);
  tl.to(
    [a, b],
    {
      attr: { opacity: 0 },
      duration: 0.2,
      onComplete() {
        a.remove();
        b.remove();
      },
    },
    delay + 0.3
  );
}

function chk(
  tl: GsapTimeline,
  layer: Element,
  x: number,
  y: number,
  color: string,
  delay: number
) {
  const p = svgEl(layer, 'polyline', {
    points: `${x - 5},${y} ${x - 1},${y + 4} ${x + 6},${y - 4}`,
    fill: 'none',
    stroke: color,
    'stroke-width': 2,
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    opacity: 0,
  });
  tl.to(p, { attr: { opacity: 1 }, duration: 0.12 }, delay);
  tl.to(
    p,
    { attr: { opacity: 0 }, duration: 0.18, onComplete: () => p.remove() },
    delay + 0.32
  );
}

/* ── Per-event animation builder ── */

export function buildEventAnim(
  ev: SimEvent,
  layer: Element,
  layout: Layout,
  topo: SimTopology
): GsapTimeline {
  const tl = gsap.timeline();
  const srvOf = (cid: string) =>
    topo.clients.find((c) => c.id === cid)?.serverId;
  const cs = (cid: string) => {
    const sid = srvOf(cid);
    if (!sid) return null;
    const a = layout.pos['s:' + sid],
      b = layout.pos['c:' + cid];
    if (!a || !b) return null;
    return { sPos: a, cPos: b, ...edgeGeo(a, b) };
  };
  const pp = pktParams(ev);

  switch (ev.type) {
    case 'client_write': {
      const p = layout.pos['c:' + requireClientId(ev)];
      if (!p) break;
      ring(tl, layer, p.x, p.y, C.blue, 24, 52, 0, 0.45);
      ring(tl, layer, p.x, p.y, C.blue, 24, 40, 0.06, 0.38);
      lbl(tl, layer, p.x, p.y - 46, 'client_write', C.blue, 0.02);
      break;
    }
    case 'server_write': {
      const p = layout.pos['s:' + requireServerId(ev)];
      if (!p) break;
      ring(tl, layer, p.x, p.y, C.yellow, 28, 54, 0, 0.45);
      ring(tl, layer, p.x, p.y, C.yellow, 28, 42, 0.06, 0.38);
      lbl(tl, layer, p.x, p.y - 50, 'server_write', C.yellow, 0.02);
      break;
    }
    case 'push_start': {
      const e = cs(requireClientId(ev));
      if (!e) break;
      ring(tl, layer, e.cPos.x, e.cPos.y, C.orange, 24, 38, 0, 0.3);
      pkts(
        tl,
        layer,
        e.cPos,
        e.ctrl,
        e.sPos,
        C.orange,
        pp.dots,
        pp.baseR,
        0.03,
        0.4
      );
      edgeFlash(tl, layer, e.d, C.orange, 0, 0.45);
      lbl(tl, layer, e.mid.x, e.mid.y - 10, 'push \u2192', C.orange, 0.03);
      break;
    }
    case 'push_success': {
      const e = cs(requireClientId(ev));
      if (!e) break;
      ring(tl, layer, e.sPos.x, e.sPos.y, C.green, 28, 52, 0, 0.4);
      edgeFlash(tl, layer, e.d, C.green, 0, 0.28);
      chk(tl, layer, e.sPos.x, e.sPos.y - 42, C.green, 0.04);
      lbl(tl, layer, e.sPos.x, e.sPos.y - 52, 'push_success', C.green, 0);
      break;
    }
    case 'push_fail': {
      const e = cs(requireClientId(ev));
      if (!e) break;
      ring(tl, layer, e.cPos.x, e.cPos.y, C.red, 24, 48, 0, 0.5);
      edgeFlash(tl, layer, e.d, C.red, 0, 0.38);
      xMk(tl, layer, e.mid.x, e.mid.y, 0.04);
      lbl(tl, layer, e.mid.x, e.mid.y - 14, 'push_fail', C.red, 0.02);
      break;
    }
    case 'poll_start': {
      const e = cs(requireClientId(ev));
      if (!e) break;
      ring(tl, layer, e.cPos.x, e.cPos.y, C.teal, 24, 36, 0, 0.3);
      pkts(tl, layer, e.cPos, e.ctrl, e.sPos, C.teal, 2, 3.5, 0.03, 0.32);
      edgeFlash(tl, layer, e.d, C.teal, 0, 0.35);
      lbl(tl, layer, e.mid.x, e.mid.y - 10, 'poll \u2192', C.teal, 0.03);
      break;
    }
    case 'poll_success': {
      const e = cs(requireClientId(ev));
      if (!e) break;
      ring(tl, layer, e.cPos.x, e.cPos.y, C.green, 24, 50, 0, 0.4);
      edgeFlash(tl, layer, e.d, C.green, 0, 0.28);
      chk(tl, layer, e.cPos.x, e.cPos.y - 38, C.green, 0.04);
      lbl(tl, layer, e.cPos.x, e.cPos.y - 48, 'poll_success', C.green, 0);
      break;
    }
    case 'poll_fail': {
      const e = cs(requireClientId(ev));
      if (!e) break;
      ring(tl, layer, e.cPos.x, e.cPos.y, C.red, 24, 46, 0, 0.5);
      edgeFlash(tl, layer, e.d, C.red, 0, 0.38);
      xMk(tl, layer, e.mid.x, e.mid.y, 0.04);
      lbl(tl, layer, e.mid.x, e.mid.y - 14, 'poll_fail', C.red, 0.02);
      break;
    }
    case 'network_op': {
      const e = cs(requireClientId(ev));
      if (!e) break;
      if (ev.phase === 'begin') {
        const col = ev.op === 'write' ? C.orange : C.green;
        const dir = ev.op === 'write';
        pkts(
          tl,
          layer,
          dir ? e.cPos : e.sPos,
          e.ctrl,
          dir ? e.sPos : e.cPos,
          col,
          pp.dots,
          pp.baseR,
          0,
          0.35
        );
        edgeFlash(tl, layer, e.d, col, 0, 0.38);
        lbl(tl, layer, e.mid.x, e.mid.y - 10, 'network_op ' + ev.op, col, 0);
      } else if (ev.ok === false) {
        edgeFlash(tl, layer, e.d, C.red, 0, 0.32);
        xMk(tl, layer, e.mid.x, e.mid.y, 0);
        lbl(tl, layer, e.mid.x, e.mid.y - 14, 'network_op error', C.red, 0);
      } else {
        edgeFlash(tl, layer, e.d, C.green, 0, 0.2);
      }
      break;
    }
    case 'remote_read': {
      const e = cs(requireClientId(ev));
      if (!e) break;
      pkts(
        tl,
        layer,
        e.sPos,
        e.ctrl,
        e.cPos,
        C.green,
        pp.dots,
        pp.baseR,
        0,
        0.42
      );
      edgeFlash(tl, layer, e.d, C.green, 0, 0.5);
      ring(tl, layer, e.cPos.x, e.cPos.y, C.green, 24, 50, 0.26, 0.38);
      const cnt = (ev.results || []).reduce((s, r) => s + r.entityCount, 0);
      lbl(
        tl,
        layer,
        e.mid.x,
        e.mid.y - 10,
        '\u2190 remote_read (' + cnt + ')',
        C.green,
        0.03
      );
      break;
    }
    case 'remote_write': {
      const e = cs(requireClientId(ev));
      if (!e) break;
      pkts(
        tl,
        layer,
        e.cPos,
        e.ctrl,
        e.sPos,
        C.orange,
        pp.dots,
        pp.baseR,
        0,
        0.42
      );
      edgeFlash(tl, layer, e.d, C.orange, 0, 0.5);
      ring(tl, layer, e.sPos.x, e.sPos.y, C.yellow, 28, 52, 0.26, 0.38);
      lbl(
        tl,
        layer,
        e.mid.x,
        e.mid.y - 10,
        'remote_write (' + ev.returnedPatchCount + ') \u2192',
        C.orange,
        0.03
      );
      break;
    }
    case 'partition': {
      const e = cs(requireClientId(ev));
      if (!e) break;
      ring(tl, layer, e.mid.x, e.mid.y, C.red, 6, 40, 0, 0.55);
      ring(tl, layer, e.cPos.x, e.cPos.y, C.red, 24, 58, 0.03, 0.5);
      xMk(tl, layer, e.mid.x, e.mid.y, 0.02);
      edgeFlash(tl, layer, e.d, C.red, 0, 0.45);
      lbl(tl, layer, e.mid.x, e.mid.y - 16, 'partition', C.red, 0);
      break;
    }
    case 'heal': {
      const e = cs(requireClientId(ev));
      if (!e) break;
      ring(tl, layer, e.mid.x, e.mid.y, C.green, 6, 34, 0, 0.45);
      ring(tl, layer, e.cPos.x, e.cPos.y, C.green, 24, 54, 0.05, 0.45);
      edgeFlash(tl, layer, e.d, C.green, 0, 0.45);
      chk(tl, layer, e.mid.x, e.mid.y - 14, C.green, 0.04);
      pkts(tl, layer, e.sPos, e.ctrl, e.cPos, C.green, 2, 3.5, 0.1, 0.3);
      lbl(tl, layer, e.mid.x, e.mid.y - 24, 'heal', C.green, 0);
      break;
    }
    case 'invalidation_scheduled': {
      const sid = srvOf(requireClientId(ev));
      if (!sid) break;
      const p = layout.pos['s:' + sid];
      if (!p) break;
      ring(tl, layer, p.x, p.y, C.violet, 28, 44, 0, 0.38);
      lbl(tl, layer, p.x, p.y - 50, 'invalidation_scheduled', C.violet, 0);
      break;
    }
    case 'invalidation_delivered': {
      const e = cs(requireClientId(ev));
      if (!e) break;
      pkts(tl, layer, e.sPos, e.ctrl, e.cPos, C.violet, 2, 3.5, 0, 0.38);
      ring(tl, layer, e.cPos.x, e.cPos.y, C.violet, 24, 46, 0.22, 0.38);
      edgeFlash(tl, layer, e.d, C.violet, 0, 0.42);
      lbl(
        tl,
        layer,
        e.mid.x,
        e.mid.y - 10,
        '\u2190 invalidation_delivered',
        C.violet,
        0.03
      );
      break;
    }
    case 'invalidation_dropped': {
      const e = cs(requireClientId(ev));
      if (!e) break;
      const dot = svgEl(layer, 'circle', {
        cx: e.sPos.x,
        cy: e.sPos.y,
        r: 4,
        fill: C.violet,
        opacity: 0,
      });
      const proxy = { t: 0 };
      tl.to(
        proxy,
        {
          t: 0.5,
          duration: 0.26,
          onStart() {
            dot.setAttribute('opacity', '0.85');
          },
          onUpdate() {
            const p = bezPt(e.sPos, e.ctrl, e.cPos, proxy.t);
            dot.setAttribute('cx', String(p.x));
            dot.setAttribute('cy', String(p.y));
          },
          onComplete() {
            gsap.to(dot, {
              attr: { opacity: 0, r: 0 },
              duration: 0.15,
              onComplete: () => dot.remove(),
            });
          },
        },
        0
      );
      xMk(tl, layer, e.mid.x, e.mid.y, 0.16);
      lbl(
        tl,
        layer,
        e.mid.x,
        e.mid.y - 14,
        'invalidation_dropped',
        C.red,
        0.06
      );
      break;
    }
    case 'subscribe': {
      const p = layout.pos['c:' + requireClientId(ev)];
      if (!p) break;
      ring(tl, layer, p.x, p.y, C.teal, 24, 38, 0, 0.34);
      lbl(tl, layer, p.x, p.y - 46, 'subscribe', C.teal, 0);
      break;
    }
    case 'unsubscribe': {
      const p = layout.pos['c:' + requireClientId(ev)];
      if (!p) break;
      ring(tl, layer, p.x, p.y, C.text, 24, 34, 0, 0.3);
      lbl(tl, layer, p.x, p.y - 46, 'unsubscribe', C.text, 0);
      break;
    }
    case 'sync_error': {
      const p = layout.pos['c:' + requireClientId(ev)];
      if (!p) break;
      ring(tl, layer, p.x, p.y, C.red, 24, 54, 0, 0.5);
      ring(tl, layer, p.x, p.y, C.red, 24, 42, 0.07, 0.42);
      xMk(tl, layer, p.x, p.y - 34, 0.02);
      lbl(tl, layer, p.x, p.y - 48, 'sync_error', C.red, 0);
      break;
    }
    case 'topology': {
      lbl(tl, layer, layout.W / 2, layout.H / 2, 'topology', C.text, 0);
      break;
    }
  }
  return tl;
}
