/**
 * Reads `.sim-recordings/*.json` and emits a self-contained sim visualization at `sim-viz/index.html`.
 * Run from repo root: `bun run src/@shared/patch-db/test/sim/generate-sim-viz.ts`
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { getRecordingsDir, loadAllRecordings } from './recording-store';

const OUT_DIR = 'sim-viz';
const OUT_FILE = join(OUT_DIR, 'index.html');

function escapeForInlineScriptJson(s: string): string {
  return s.replace(/</g, '\\u003c').replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

const VIZ_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Patch DB simulation timeline</title>
  <style>
    :root {
      --bg: #0f1419;
      --panel: #1a2332;
      --border: #2d3a4d;
      --text: #e7eef6;
      --muted: #8b9cb3;
      --accent: #5b9cf7;
      --write: #5b9cf7;
      --push: #e8943a;
      --poll: #4caf7c;
      --fail: #e85d5d;
      --part: rgba(232, 93, 93, 0.25);
      --sub: rgba(76, 175, 124, 0.2);
      --lane: #243043;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .header {
      padding: 8px 16px;
      border-bottom: 1px solid var(--border);
      background: var(--panel);
      font-size: 14px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .header kbd {
      background: var(--bg);
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      border: 1px solid var(--border);
    }
    .main-row {
      flex: 1;
      display: flex;
      min-height: 0;
    }
    .sidebar {
      width: 280px;
      border-right: 1px solid var(--border);
      background: var(--panel);
      overflow-y: auto;
      flex-shrink: 0;
    }
    .sidebar h2 {
      margin: 12px 16px 8px;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: var(--muted);
    }
    .rec-list {
      list-style: none;
      margin: 0;
      padding: 0 8px 16px;
    }
    .rec-item {
      padding: 10px 12px;
      margin-bottom: 4px;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid transparent;
    }
    .rec-item:hover { background: rgba(255,255,255,0.04); }
    .rec-item.active {
      border-color: var(--accent);
      background: rgba(91, 156, 247, 0.12);
    }
    .rec-item .id { font-weight: 600; font-size: 13px; word-break: break-all; }
    .rec-item .meta { font-size: 11px; color: var(--muted); margin-top: 4px; }
    .viz-wrap {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      background: var(--bg);
    }
    .svg-scroll {
      flex: 1;
      overflow: auto;
      position: relative;
      cursor: grab;
    }
    .svg-scroll.panning { cursor: grabbing; }
    .timeline-svg {
      display: block;
      min-width: 100%;
    }
    .lane-bg { fill: var(--lane); }
    .lane-line { stroke: var(--border); stroke-width: 1; }
    .time-tick { stroke: var(--border); stroke-width: 0.5; opacity: 0.6; }
    .time-label { fill: var(--muted); font-size: 10px; }
    .actor-label { fill: var(--text); font-size: 11px; font-weight: 600; }
    .evt-write { fill: var(--write); stroke: #1a3a6e; stroke-width: 0.5; }
    .evt-push { fill: var(--push); }
    .evt-poll { fill: var(--poll); }
    .evt-fail { fill: var(--fail); }
    .evt-net { fill: #9b7ed9; }
    .evt-remote { fill: #6ec9c5; }
    .evt-part { fill: var(--fail); }
    .evt-heal { fill: var(--poll); }
    .evt-inv { fill: #b0b8c4; stroke-dasharray: 2 2; }
    .evt-sub { fill: #7cb9ff; }
    .evt-server { fill: #c9a45c; }
    .evt-topology { fill: var(--muted); }
    .evt-sync-err { fill: var(--fail); }
    .arrow-push { stroke: var(--push); stroke-width: 1.5; fill: none; marker-end: url(#arrowOrange); }
    .arrow-poll { stroke: var(--poll); stroke-width: 1.5; fill: none; marker-end: url(#arrowGreen); }
    .arrow-inv { stroke: #8899aa; stroke-width: 1; stroke-dasharray: 4 3; fill: none; opacity: 0.85; }
    .part-band { fill: var(--part); }
    .sub-band { fill: var(--sub); }
    .detail {
      height: 200px;
      border-top: 1px solid var(--border);
      background: var(--panel);
      padding: 12px 16px;
      overflow: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .empty {
      padding: 40px;
      text-align: center;
      color: var(--muted);
    }
    .tooltip {
      position: fixed;
      pointer-events: none;
      background: #252f40;
      border: 1px solid var(--border);
      padding: 6px 10px;
      border-radius: 6px;
      font-size: 11px;
      max-width: 320px;
      z-index: 100;
      display: none;
    }
  </style>
</head>
<body>
  <div class="header">
    <strong>Sim viz</strong>
    <span style="color:var(--muted)">Recordings: <span id="dir-label"></span></span>
    <span style="margin-left:auto;color:var(--muted)">
      Wheel: zoom · drag: pan · <kbd>←</kbd><kbd>→</kbd> step events
    </span>
  </div>
  <div class="main-row">
    <aside class="sidebar">
      <h2>Scenarios</h2>
      <ul class="rec-list" id="rec-list"></ul>
    </aside>
    <div class="viz-wrap">
      <div class="svg-scroll" id="svg-scroll">
        <svg class="timeline-svg" id="timeline" xmlns="http://www.w3.org/2000/svg"></svg>
      </div>
      <div class="detail" id="detail">Select a recording and click an event.</div>
    </div>
  </div>
  <div class="tooltip" id="tooltip"></div>
  <script>
  (function () {
    const RECORDINGS = __RECORDINGS_JSON__;
    const dirLabel = document.getElementById('dir-label');
    dirLabel.textContent = __DIR_LABEL__;

    if (!RECORDINGS.length) {
      document.getElementById('rec-list').innerHTML =
        '<li class="empty">No recordings found. Run <code>test:viz</code> first.</li>';
      document.getElementById('timeline').innerHTML = '';
      return;
    }

    let selectedIdx = 0;
    let selectedEventSeq = null;
    let scale = 2;
    let panX = 40;
    let panY = 20;

    const listEl = document.getElementById('rec-list');
    const svg = document.getElementById('timeline');
    const scrollEl = document.getElementById('svg-scroll');
    const detailEl = document.getElementById('detail');
    const tooltipEl = document.getElementById('tooltip');

    function recSummary(r) {
      const s = r.topology.servers.length;
      const c = r.topology.clients.length;
      return s + ' srv, ' + c + ' cli — ' + r.events.length + ' events';
    }

    function buildList() {
      listEl.innerHTML = '';
      RECORDINGS.forEach((r, i) => {
        const li = document.createElement('li');
        li.className = 'rec-item' + (i === selectedIdx ? ' active' : '');
        li.innerHTML = '<div class="id">' + r.id + '</div><div class="meta">' + recSummary(r) + '</div>';
        li.onclick = () => { selectedIdx = i; selectedEventSeq = null; buildList(); render(); };
        listEl.appendChild(li);
      });
    }

    function laneIndex(topology, ev) {
      const servers = topology.servers.map((s) => 'srv:' + s.id);
      const clients = topology.clients.map((c) => 'cli:' + c.id);
      const order = servers.concat(clients);

      function idxFor(key) {
        const i = order.indexOf(key);
        return i >= 0 ? i : 0;
      }

      switch (ev.type) {
        case 'topology': return -1;
        case 'server_write':
          return idxFor('srv:' + ev.serverId);
        case 'client_write':
        case 'push_start':
        case 'push_success':
        case 'push_fail':
        case 'poll_start':
        case 'poll_success':
        case 'poll_fail':
        case 'network_op':
        case 'remote_read':
        case 'remote_write':
        case 'partition':
        case 'heal':
        case 'invalidation_scheduled':
        case 'invalidation_delivered':
        case 'invalidation_dropped':
        case 'subscribe':
        case 'unsubscribe':
        case 'sync_error':
          return idxFor('cli:' + ev.clientId);
        default:
          return 0;
      }
    }

    function evtClass(t) {
      const m = {
        client_write: 'evt-write',
        push_start: 'evt-push',
        push_success: 'evt-push',
        push_fail: 'evt-fail',
        poll_start: 'evt-poll',
        poll_success: 'evt-poll',
        poll_fail: 'evt-fail',
        network_op: 'evt-net',
        remote_read: 'evt-remote',
        remote_write: 'evt-remote',
        partition: 'evt-part',
        heal: 'evt-heal',
        invalidation_scheduled: 'evt-inv',
        invalidation_delivered: 'evt-inv',
        invalidation_dropped: 'evt-inv',
        subscribe: 'evt-sub',
        unsubscribe: 'evt-sub',
        server_write: 'evt-server',
        topology: 'evt-topology',
        sync_error: 'evt-sync-err',
      };
      return m[t] || 'evt-net';
    }

    function timeRange(rec) {
      let t0 = rec.startedAt;
      let t1 = rec.endedAt;
      for (const e of rec.events) {
        if (e.time < t0) t0 = e.time;
        if (e.time > t1) t1 = e.time;
      }
      if (t1 <= t0) t1 = t0 + 1;
      return { t0, t1 };
    }

    function render() {
      const rec = RECORDINGS[selectedIdx];
      if (!rec) return;

      const topology = rec.topology;
      const servers = topology.servers;
      const clients = topology.clients;
      const laneLabels = servers.map((s) => 'Server ' + s.id).concat(clients.map((c) => 'Client ' + c.id));
      const laneCount = laneLabels.length;
      const { t0, t1 } = timeRange(rec);
      const duration = t1 - t0;

      const laneH = 44;
      const topPad = 36;
      const leftPad = 120;
      const rightPad = 40;
      const wTime = Math.max(800, duration * scale) + leftPad + rightPad;
      const h = topPad + laneCount * laneH + 24;

      const events = rec.events.filter((e) => e.type !== 'topology');

      while (svg.firstChild) svg.removeChild(svg.firstChild);

      const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML =
        '<marker id="arrowOrange" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">' +
        '<path d="M0,0 L8,4 L0,8 z" fill="#e8943a"/></marker>' +
        '<marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">' +
        '<path d="M0,0 L8,4 L0,8 z" fill="#4caf7c"/></marker>';
      svg.appendChild(defs);

      const gRoot = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gRoot.setAttribute('transform', 'translate(' + panX + ',' + panY + ')');
      svg.appendChild(gRoot);

      function xAt(time) {
        return leftPad + ((time - t0) / duration) * (wTime - leftPad - rightPad);
      }

      // Partition overlays per client
      const partState = {};
      const subs = {};

      for (const e of rec.events) {
        const cid = e.clientId;
        if (e.type === 'partition' && cid) partState[cid] = e.time;
        if (e.type === 'heal' && cid && partState[cid] != null) {
          const li = laneIndex(topology, { type: 'partition', clientId: cid });
          const y = topPad + li * laneH;
          const x0 = xAt(partState[cid]);
          const x1 = xAt(e.time);
          const band = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
          band.setAttribute('class', 'part-band');
          band.setAttribute('x', Math.min(x0, x1));
          band.setAttribute('y', y + 4);
          band.setAttribute('width', Math.abs(x1 - x0));
          band.setAttribute('height', laneH - 8);
          gRoot.appendChild(band);
          partState[cid] = null;
        }
      }

      for (const e of rec.events) {
        if (e.type === 'subscribe' && e.clientId) {
          const k = e.clientId + '|' + e.mode + '|' + e.queryKey;
          subs[k] = e.time;
        }
        if (e.type === 'unsubscribe' && e.clientId) {
          const k = e.clientId + '|' + e.mode + '|' + e.queryKey;
          if (subs[k] != null) {
            const li = laneIndex(topology, e);
            const y = topPad + li * laneH;
            const x0 = xAt(subs[k]);
            const x1 = xAt(e.time);
            const band = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            band.setAttribute('class', 'sub-band');
            band.setAttribute('x', Math.min(x0, x1));
            band.setAttribute('y', y + 10);
            band.setAttribute('width', Math.abs(x1 - x0));
            band.setAttribute('height', laneH - 20);
            gRoot.appendChild(band);
            subs[k] = null;
          }
        }
      }

      // Lanes
      for (let i = 0; i < laneCount; i++) {
        const y = topPad + i * laneH;
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', 'lane-bg');
        rect.setAttribute('x', 0);
        rect.setAttribute('y', y);
        rect.setAttribute('width', wTime);
        rect.setAttribute('height', laneH);
        rect.setAttribute('opacity', i % 2 ? '0.5' : '0.35');
        gRoot.appendChild(rect);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'lane-line');
        line.setAttribute('x1', 0);
        line.setAttribute('x2', wTime);
        line.setAttribute('y1', y + laneH);
        line.setAttribute('y2', y + laneH);
        gRoot.appendChild(line);
        const lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        lbl.setAttribute('class', 'actor-label');
        lbl.setAttribute('x', 8);
        lbl.setAttribute('y', y + laneH / 2 + 4);
        lbl.textContent = laneLabels[i];
        gRoot.appendChild(lbl);
      }

      const ticks = Math.min(12, Math.ceil(duration / 10) + 1);
      for (let i = 0; i <= ticks; i++) {
        const t = t0 + (duration * i) / ticks;
        const x = xAt(t);
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'time-tick');
        line.setAttribute('x1', x);
        line.setAttribute('x2', x);
        line.setAttribute('y1', topPad - 6);
        line.setAttribute('y2', h - 8);
        gRoot.appendChild(line);
        const tl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tl.setAttribute('class', 'time-label');
        tl.setAttribute('x', x - 12);
        tl.setAttribute('y', topPad - 10);
        tl.textContent = String(Math.round(t - t0));
        gRoot.appendChild(tl);
      }

      // Arrows: push_success (client -> server), poll_success (server -> client)
      for (const e of rec.events) {
        if (e.type === 'push_success' && e.clientId) {
          const cli = topology.clients.find((c) => c.id === e.clientId);
          if (!cli) continue;
          const si = servers.findIndex((s) => s.id === cli.serverId);
          const ci = servers.length + topology.clients.findIndex((c) => c.id === e.clientId);
          if (si < 0 || ci < 0) continue;
          const yS = topPad + si * laneH + laneH / 2;
          const yC = topPad + ci * laneH + laneH / 2;
          const x = xAt(e.time);
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('class', 'arrow-push');
          path.setAttribute('d', 'M' + x + ',' + yC + ' L' + x + ',' + yS);
          gRoot.appendChild(path);
        }
        if (e.type === 'poll_success' && e.clientId) {
          const cli = topology.clients.find((c) => c.id === e.clientId);
          if (!cli) continue;
          const si = servers.findIndex((s) => s.id === cli.serverId);
          const ci = servers.length + topology.clients.findIndex((c) => c.id === e.clientId);
          if (si < 0 || ci < 0) continue;
          const yS = topPad + si * laneH + laneH / 2;
          const yC = topPad + ci * laneH + laneH / 2;
          const x = xAt(e.time);
          const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('class', 'arrow-poll');
          path.setAttribute('d', 'M' + x + ',' + yS + ' L' + x + ',' + yC);
          gRoot.appendChild(path);
        }
        if (e.type === 'invalidation_delivered' && e.clientId) {
          const li = laneIndex(topology, e);
          const prev = rec.events.filter((x) => x.seq < e.seq && x.type === 'invalidation_scheduled' && x.clientId === e.clientId);
          const sch = prev.length ? prev[prev.length - 1] : null;
          if (sch) {
            const y = topPad + li * laneH + laneH / 2;
            const x0 = xAt(sch.time);
            const x1 = xAt(e.time);
            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('class', 'arrow-inv');
            path.setAttribute('d', 'M' + x0 + ',' + (y + 6) + ' Q' + ((x0 + x1) / 2) + ',' + (y - 14) + ' ' + x1 + ',' + y);
            gRoot.appendChild(path);
          }
        }
      }

      // Event markers
      for (const e of events) {
        const li = laneIndex(topology, e);
        if (li < 0) continue;
        const y = topPad + li * laneH + laneH / 2;
        const x = xAt(e.time);
        const isFail = e.type === 'push_fail' || e.type === 'poll_fail' || e.type === 'sync_error';
        const isLine = e.type === 'partition' || e.type === 'heal';
        if (isLine) {
          const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line.setAttribute('stroke', e.type === 'partition' ? '#e85d5d' : '#4caf7c');
          line.setAttribute('stroke-width', '2');
          line.setAttribute('x1', x);
          line.setAttribute('x2', x);
          line.setAttribute('y1', topPad + li * laneH + 4);
          line.setAttribute('y2', topPad + li * laneH + laneH - 4);
          line.setAttribute('data-seq', String(e.seq));
          line.style.cursor = 'pointer';
          gRoot.appendChild(line);
        } else if (isFail) {
          const t = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          t.setAttribute('x', x - 5);
          t.setAttribute('y', y + 4);
          t.setAttribute('fill', '#e85d5d');
          t.setAttribute('font-weight', 'bold');
          t.setAttribute('data-seq', String(e.seq));
          t.style.cursor = 'pointer';
          t.textContent = '✕';
          gRoot.appendChild(t);
        } else {
          const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          c.setAttribute('class', evtClass(e.type));
          c.setAttribute('cx', x);
          c.setAttribute('cy', y);
          c.setAttribute('r', e.type === 'network_op' && e.phase === 'begin' ? 3 : 5);
          c.setAttribute('data-seq', String(e.seq));
          c.style.cursor = 'pointer';
          if (selectedEventSeq === e.seq) {
            c.setAttribute('stroke', '#fff');
            c.setAttribute('stroke-width', '2');
          }
          gRoot.appendChild(c);
        }
      }

      svg.setAttribute('width', wTime);
      svg.setAttribute('height', h);
      svg.setAttribute('viewBox', '0 0 ' + wTime + ' ' + h);

      // Interaction: delegate to svg
      function showDetail(seq) {
        const ev = rec.events.find((x) => x.seq === seq);
        detailEl.textContent = ev ? JSON.stringify(ev, null, 2) : '';
        selectedEventSeq = seq;
        render();
      }

      function attachHitTargets() {
        const nodes = svg.querySelectorAll('[data-seq]');
        nodes.forEach((node) => {
          node.addEventListener('click', (ev) => {
            ev.stopPropagation();
            showDetail(Number(node.getAttribute('data-seq')));
          });
          node.addEventListener('mouseenter', (ev) => {
            const seq = Number(node.getAttribute('data-seq'));
            const e = rec.events.find((x) => x.seq === seq);
            if (!e) return;
            tooltipEl.style.display = 'block';
            tooltipEl.textContent = e.type + ' @t=' + e.time + ' seq=' + e.seq;
          });
          node.addEventListener('mouseleave', () => {
            tooltipEl.style.display = 'none';
          });
        });
      }
      attachHitTargets();

      if (selectedEventSeq != null) {
        const ev = rec.events.find((x) => x.seq === selectedEventSeq);
        detailEl.textContent = ev ? JSON.stringify(ev, null, 2) : '';
      }

      // Prevent re-entry infinite loop: render calls attachHitTargets which may need selected highlight without full rerender
    }

    let isPan = false;
    let startX = 0, startY = 0, startPanX = 0, startPanY = 0;

    scrollEl.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      isPan = true;
      scrollEl.classList.add('panning');
      startX = e.clientX;
      startY = e.clientY;
      startPanX = panX;
      startPanY = panY;
    });
    window.addEventListener('mouseup', () => {
      isPan = false;
      scrollEl.classList.remove('panning');
    });
    window.addEventListener('mousemove', (e) => {
      if (!isPan) return;
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      const g = svg.querySelector('g');
      if (g) g.setAttribute('transform', 'translate(' + panX + ',' + panY + ')');
    });
    scrollEl.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const d = e.deltaY > 0 ? -0.15 : 0.15;
        scale = Math.min(12, Math.max(0.3, scale * (1 + d)));
        render();
      },
      { passive: false }
    );

    document.addEventListener('mousemove', (e) => {
      if (tooltipEl.style.display === 'block') {
        tooltipEl.style.left = e.clientX + 14 + 'px';
        tooltipEl.style.top = e.clientY + 14 + 'px';
      }
    });

    document.addEventListener('keydown', (e) => {
      const rec = RECORDINGS[selectedIdx];
      if (!rec || ['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return;
      const evs = rec.events.filter((x) => x.type !== 'topology');
      if (!evs.length) return;
      let idx = evs.findIndex((x) => x.seq === selectedEventSeq);
      if (idx < 0) idx = 0;
      else if (e.key === 'ArrowRight') idx = Math.min(evs.length - 1, idx + 1);
      else if (e.key === 'ArrowLeft') idx = Math.max(0, idx - 1);
      else return;
      const ev = evs[idx];
      selectedEventSeq = ev.seq;
      detailEl.textContent = JSON.stringify(ev, null, 2);
      render();
    });

    buildList();
    render();
  })();
  </script>
</body>
</html>
`;

function main(): void {
  const recordings = loadAllRecordings();
  const dir = getRecordingsDir();
  const json = escapeForInlineScriptJson(JSON.stringify(recordings));
  const html = VIZ_HTML_TEMPLATE.replace('__RECORDINGS_JSON__', json).replace(
    '__DIR_LABEL__',
    JSON.stringify(dir)
  );
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(OUT_FILE, html, 'utf-8');
  console.log('Wrote', OUT_FILE, '(' + recordings.length + ' recordings)');
}

main();
