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

/** One self-contained HTML document: fonts, hero, playback, legend, swimlanes (no external JS). */
const VIZ_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Patch DB — simulation timelines</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;1,9..144,600&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #0c0e14;
      --bg-elevated: #121622;
      --panel: #161b28;
      --border: #2a3348;
      --text: #eef2f9;
      --muted: #8b97b0;
      --accent: #6ea8ff;
      --write: #5b9cf7;
      --push: #e8943a;
      --poll: #4ecf8e;
      --fail: #f07178;
      --part: rgba(240, 113, 120, 0.22);
      --sub: rgba(78, 207, 142, 0.15);
      --lane: #1e2536;
      --playhead: rgba(255, 255, 255, 0.85);
      --mesh1: rgba(110, 168, 255, 0.09);
      --mesh2: rgba(232, 148, 58, 0.06);
      --font-display: "Fraunces", Georgia, serif;
      --font-body: "Source Sans 3", system-ui, sans-serif;
      --transition: 0.18s ease;
    }
    @media (prefers-reduced-motion: reduce) {
      :root { --transition: 0.01s; }
      *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--font-body);
      background: var(--bg);
      color: var(--text);
      height: 100vh;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .top-bar {
      flex-shrink: 0;
      padding: 10px 20px;
      border-bottom: 1px solid var(--border);
      background:
        radial-gradient(1200px 400px at 10% -20%, var(--mesh1), transparent 55%),
        radial-gradient(800px 300px at 90% 0%, var(--mesh2), transparent 50%),
        var(--panel);
      display: flex;
      align-items: center;
      gap: 16px;
      flex-wrap: wrap;
    }
    .top-bar h1 {
      margin: 0;
      font-family: var(--font-display);
      font-size: 1.15rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .top-bar .sub {
      color: var(--muted);
      font-size: 0.85rem;
    }
    .top-bar .grow { flex: 1; min-width: 8px; }
    .top-bar kbd {
      background: var(--bg);
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 0.72rem;
      border: 1px solid var(--border);
    }
    .layout {
      flex: 1;
      display: flex;
      min-height: 0;
    }
    .sidebar {
      width: 300px;
      border-right: 1px solid var(--border);
      background: var(--bg-elevated);
      overflow-y: auto;
      flex-shrink: 0;
    }
    .sidebar h2 {
      margin: 14px 18px 8px;
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: var(--muted);
      font-weight: 600;
    }
    .rec-list { list-style: none; margin: 0; padding: 0 10px 20px; }
    .rec-item {
      padding: 12px 14px;
      margin-bottom: 6px;
      border-radius: 10px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: background var(--transition), border-color var(--transition);
    }
    .rec-item:hover { background: rgba(255,255,255,0.04); }
    .rec-item.active {
      border-color: var(--accent);
      background: rgba(110, 168, 255, 0.1);
    }
    .rec-item .title { font-weight: 600; font-size: 0.92rem; line-height: 1.35; }
    .rec-item .sub { font-size: 0.72rem; color: var(--muted); margin-top: 6px; word-break: break-word; }
    .rec-item .id-line { font-size: 0.65rem; color: var(--muted); opacity: 0.75; margin-top: 4px; font-family: ui-monospace, monospace; }

    .main {
      flex: 1;
      display: flex;
      flex-direction: column;
      min-width: 0;
      background: var(--bg);
    }
    .hero {
      flex-shrink: 0;
      padding: 16px 22px;
      border-bottom: 1px solid var(--border);
      background: linear-gradient(180deg, rgba(30,37,54,0.5) 0%, transparent 100%);
    }
    .hero h2 {
      margin: 0 0 8px;
      font-family: var(--font-display);
      font-size: 1.35rem;
      font-weight: 600;
      letter-spacing: -0.02em;
    }
    .hero .intent {
      margin: 0 0 10px;
      color: var(--muted);
      font-size: 0.9rem;
      max-width: 72ch;
      line-height: 1.5;
    }
    .hero .desc {
      margin: 0 0 12px;
      font-size: 0.82rem;
      color: var(--text);
      opacity: 0.9;
      max-width: 80ch;
      line-height: 1.55;
    }
    .chips { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px; }
    .chip {
      font-size: 0.68rem;
      padding: 4px 10px;
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--border);
      color: var(--muted);
    }
    .chip strong { color: var(--text); font-weight: 600; }

    .playback {
      flex-shrink: 0;
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 22px;
      border-bottom: 1px solid var(--border);
      background: var(--bg-elevated);
      flex-wrap: wrap;
    }
    .playback button {
      font-family: var(--font-body);
      font-weight: 600;
      font-size: 0.85rem;
      padding: 8px 16px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: rgba(110, 168, 255, 0.15);
      color: var(--text);
      cursor: pointer;
      transition: background var(--transition);
    }
    .playback button:hover { background: rgba(110, 168, 255, 0.28); }
    .playback button:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
    .playback label { font-size: 0.8rem; color: var(--muted); display: flex; align-items: center; gap: 6px; cursor: pointer; }
    .playback input[type="range"] { flex: 1; min-width: 120px; max-width: 420px; accent-color: var(--accent); }
    .playback select {
      font-family: var(--font-body);
      font-size: 0.8rem;
      padding: 6px 10px;
      border-radius: 6px;
      border: 1px solid var(--border);
      background: var(--panel);
      color: var(--text);
    }
    .time-readout { font-variant-numeric: tabular-nums; font-size: 0.8rem; color: var(--muted); min-width: 120px; }

    .viz-row {
      flex: 1;
      display: flex;
      min-height: 0;
    }
    .legend {
      width: 148px;
      flex-shrink: 0;
      border-right: 1px solid var(--border);
      padding: 12px 14px;
      font-size: 0.72rem;
      color: var(--muted);
      background: var(--bg-elevated);
      overflow-y: auto;
    }
    .legend h3 { margin: 0 0 10px; font-size: 0.65rem; text-transform: uppercase; letter-spacing: 0.1em; color: var(--muted); }
    .legend-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
    .legend-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
    .svg-scroll {
      flex: 1;
      overflow: auto;
      position: relative;
      cursor: grab;
    }
    .svg-scroll.panning { cursor: grabbing; }
    .timeline-svg { display: block; min-width: 100%; }
    .lane-bg { fill: var(--lane); }
    .lane-line { stroke: var(--border); stroke-width: 1; }
    .time-tick { stroke: var(--border); stroke-width: 0.5; opacity: 0.55; }
    .time-label { fill: var(--muted); font-size: 10px; }
    .actor-label { fill: var(--text); font-size: 11px; font-weight: 600; }
    .playhead-line { stroke: var(--playhead); stroke-width: 1.5; pointer-events: none; opacity: 0.95; }
    .evt-write { fill: var(--write); }
    .evt-push { fill: var(--push); }
    .evt-poll { fill: var(--poll); }
    .evt-fail { fill: var(--fail); }
    .evt-net { fill: #b39dfa; }
    .evt-remote { fill: #5fd4c6; }
    .evt-part { fill: var(--fail); }
    .evt-heal { fill: var(--poll); }
    .evt-inv { fill: #a8b0c4; }
    .evt-sub { fill: #7eb6ff; }
    .evt-server { fill: #d4a84b; }
    .evt-sync-err { fill: var(--fail); }
    .arrow-push { stroke: var(--push); stroke-width: 1.5; fill: none; marker-end: url(#arrowOrange); }
    .arrow-poll { stroke: var(--poll); stroke-width: 1.5; fill: none; marker-end: url(#arrowGreen); }
    .arrow-inv { stroke: #8899aa; stroke-width: 1; stroke-dasharray: 4 3; fill: none; opacity: 0.85; }
    .part-band { fill: var(--part); }
    .sub-band { fill: var(--sub); }
    .detail {
      height: 180px;
      flex-shrink: 0;
      border-top: 1px solid var(--border);
      background: var(--panel);
      padding: 12px 22px;
      overflow: auto;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 11px;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .empty { padding: 48px; text-align: center; color: var(--muted); }
    .tooltip {
      position: fixed;
      pointer-events: none;
      background: #1e2638;
      border: 1px solid var(--border);
      padding: 8px 12px;
      border-radius: 8px;
      font-size: 11px;
      max-width: 340px;
      z-index: 100;
      display: none;
      box-shadow: 0 8px 24px rgba(0,0,0,0.35);
    }
  </style>
</head>
<body>
  <header class="top-bar">
    <h1>Patch DB sim</h1>
    <span class="sub">Recordings: <span id="dir-label"></span></span>
    <span class="grow"></span>
    <span class="sub"><kbd>Space</kbd> play/pause · <kbd>←</kbd><kbd>→</kbd> step · wheel zoom · drag pan</span>
  </header>
  <div class="layout">
    <aside class="sidebar">
      <h2>Scenarios</h2>
      <ul class="rec-list" id="rec-list"></ul>
    </aside>
    <div class="main">
      <section class="hero" id="hero">
        <h2 id="hero-title">—</h2>
        <p class="intent" id="hero-intent" hidden></p>
        <p class="desc" id="hero-desc" hidden></p>
        <div class="chips" id="hero-chips"></div>
      </section>
      <div class="playback">
        <button type="button" id="btn-play" aria-pressed="false">Play</button>
        <input type="range" id="scrubber" min="0" max="1000" value="0" aria-label="Timeline" />
        <label><input type="checkbox" id="loop" checked /> Loop</label>
        <label>Speed
          <select id="speed" aria-label="Playback speed">
            <option value="0.5">0.5×</option>
            <option value="1" selected>1×</option>
            <option value="2">2×</option>
          </select>
        </label>
        <span class="time-readout" id="time-readout">t = 0</span>
      </div>
      <div class="viz-row">
        <aside class="legend">
          <h3>Legend</h3>
          <div class="legend-row"><span class="legend-dot" style="background:var(--write)"></span> Local write</div>
          <div class="legend-row"><span class="legend-dot" style="background:var(--push)"></span> Push</div>
          <div class="legend-row"><span class="legend-dot" style="background:var(--poll)"></span> Poll</div>
          <div class="legend-row"><span class="legend-dot" style="background:var(--text)"></span> Network / remote</div>
          <div class="legend-row"><span class="legend-dot" style="background:var(--fail)"></span> Failure / sync_error</div>
          <div class="legend-row"><span class="legend-dot" style="background:var(--fail);opacity:0.6"></span> Partition</div>
          <div class="legend-row"><span class="legend-dot" style="background:var(--poll);opacity:0.7"></span> Heal</div>
          <div class="legend-row"><span class="legend-dot" style="background:#a8b0c4"></span> Invalidation</div>
          <div class="legend-row"><span class="legend-dot" style="background:#7eb6ff"></span> Subscribe</div>
          <div class="legend-row"><span class="legend-dot" style="background:var(--sub)"></span> Sub window</div>
          <div class="legend-row"><span class="legend-dot" style="background:var(--part)"></span> Partition span</div>
        </aside>
        <div class="svg-scroll" id="svg-scroll">
          <svg class="timeline-svg" id="timeline" xmlns="http://www.w3.org/2000/svg"></svg>
        </div>
      </div>
      <div class="detail" id="detail">Select a scenario. Scrub or play the timeline, then click an event for JSON.</div>
    </div>
  </div>
  <div class="tooltip" id="tooltip"></div>
  <script>
  (function () {
    const RAW = __RECORDINGS_JSON__;
    const RECORDINGS = Array.isArray(RAW) ? RAW.slice() : [];
    RECORDINGS.sort(function (a, b) {
      var ta = (a.meta && a.meta.title) ? a.meta.title : a.id;
      var tb = (b.meta && b.meta.title) ? b.meta.title : b.id;
      var c = String(ta).localeCompare(String(tb));
      if (c !== 0) return c;
      return a.id.localeCompare(b.id);
    });

    document.getElementById('dir-label').textContent = __DIR_LABEL__;

    if (!RECORDINGS.length) {
      document.getElementById('rec-list').innerHTML =
        '<li class="empty">No recordings. Run <code>bun run test:viz</code> first.</li>';
      document.getElementById('timeline').innerHTML = '';
      document.getElementById('hero-title').textContent = 'No data';
      return;
    }

    var selectedIdx = 0;
    var selectedEventSeq = null;
    var scale = 2;
    var panX = 40;
    var panY = 20;
    var tPlay = 0;
    var tMin = 0;
    var tMax = 1;
    var isPlaying = false;
    var lastFrameTime = 0;
    var rafId = 0;

    var listEl = document.getElementById('rec-list');
    var svg = document.getElementById('timeline');
    var scrollEl = document.getElementById('svg-scroll');
    var detailEl = document.getElementById('detail');
    var tooltipEl = document.getElementById('tooltip');
    var heroTitle = document.getElementById('hero-title');
    var heroIntent = document.getElementById('hero-intent');
    var heroDesc = document.getElementById('hero-desc');
    var heroChips = document.getElementById('hero-chips');
    var scrubber = document.getElementById('scrubber');
    var btnPlay = document.getElementById('btn-play');
    var loopEl = document.getElementById('loop');
    var speedEl = document.getElementById('speed');
    var timeReadout = document.getElementById('time-readout');

    function recLabel(r) {
      return (r.meta && r.meta.title) ? r.meta.title : r.id;
    }

    function recSummaryLine(r) {
      var s = r.topology.servers.length;
      var c = r.topology.clients.length;
      var parts = [s + ' srv · ' + c + ' cli · ' + r.events.length + ' events'];
      if (r.meta && r.meta.source && r.meta.source.testName) {
        parts.push(r.meta.source.testName);
      }
      return parts.join(' — ');
    }

    function syncBounds(rec) {
      var t0 = rec.startedAt;
      var t1 = rec.endedAt;
      var i, e;
      for (i = 0; i < rec.events.length; i++) {
        e = rec.events[i];
        if (e.time < t0) t0 = e.time;
        if (e.time > t1) t1 = e.time;
      }
      if (t1 <= t0) t1 = t0 + 1;
      tMin = t0;
      tMax = t1;
      if (tPlay < tMin || tPlay > tMax) tPlay = tMin;
    }

    function updateHero(rec) {
      heroTitle.textContent = recLabel(rec);
      if (rec.meta && rec.meta.intent) {
        heroIntent.textContent = rec.meta.intent;
        heroIntent.hidden = false;
      } else {
        heroIntent.textContent = '';
        heroIntent.hidden = true;
      }
      if (rec.meta && rec.meta.description) {
        heroDesc.textContent = rec.meta.description;
        heroDesc.hidden = false;
      } else {
        heroDesc.textContent = '';
        heroDesc.hidden = true;
      }
      heroChips.innerHTML = '';
      function addChip(label, value) {
        var span = document.createElement('span');
        span.className = 'chip';
        span.innerHTML = '<strong>' + label + '</strong> ' + escapeHtml(value);
        heroChips.appendChild(span);
      }
      function escapeHtml(s) {
        return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      }
      var ids = rec.topology.servers.map(function (x) { return x.id; }).join(', ');
      var cid = rec.topology.clients.map(function (x) { return x.id + '→' + x.serverId; }).join(', ');
      addChip('Servers', ids || '—');
      addChip('Clients', cid || '—');
      if (rec.meta && rec.meta.source) {
        var src = rec.meta.source;
        if (src.suite) addChip('Suite', src.suite);
        if (src.testFile) {
          var parts = src.testFile.split('/');
          addChip('File', parts[parts.length - 1] || src.testFile);
        }
        if (src.testName) addChip('Test', src.testName);
      }
      addChip('Recording id', rec.id.slice(0, 8) + '…');
    }

    function updateScrubberFromT() {
      var span = tMax - tMin;
      var p = span > 0 ? ((tPlay - tMin) / span) * 1000 : 0;
      scrubber.value = String(Math.round(Math.max(0, Math.min(1000, p))));
      timeReadout.textContent = 't = ' + Math.round(tPlay - tMin) + ' / ' + Math.round(tMax - tMin);
    }

    function applyScrubberValue() {
      var p = Number(scrubber.value) / 1000;
      tPlay = tMin + p * (tMax - tMin);
      timeReadout.textContent = 't = ' + Math.round(tPlay - tMin) + ' / ' + Math.round(tMax - tMin);
      render();
    }

    function stopPlayback() {
      isPlaying = false;
      btnPlay.textContent = 'Play';
      btnPlay.setAttribute('aria-pressed', 'false');
      lastFrameTime = 0;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }

    function startPlayback() {
      isPlaying = true;
      btnPlay.textContent = 'Pause';
      btnPlay.setAttribute('aria-pressed', 'true');
      lastFrameTime = 0;
      function tick(now) {
        if (!isPlaying) return;
        if (!lastFrameTime) lastFrameTime = now;
        var dtReal = now - lastFrameTime;
        lastFrameTime = now;
        var span = tMax - tMin;
        var wallMs = 14000;
        var logicalPerReal = span / wallMs * Number(speedEl.value);
        tPlay += dtReal * logicalPerReal;
        if (tPlay >= tMax) {
          if (loopEl.checked) tPlay = tMin;
          else { tPlay = tMax; stopPlayback(); }
        }
        updateScrubberFromT();
        render();
        if (isPlaying) rafId = requestAnimationFrame(tick);
      }
      rafId = requestAnimationFrame(tick);
    }

    btnPlay.addEventListener('click', function () {
      if (isPlaying) stopPlayback();
      else startPlayback();
    });
    scrubber.addEventListener('input', function () {
      stopPlayback();
      applyScrubberValue();
    });

    function buildList() {
      listEl.innerHTML = '';
      RECORDINGS.forEach(function (r, i) {
        var li = document.createElement('li');
        li.className = 'rec-item' + (i === selectedIdx ? ' active' : '');
        li.innerHTML =
          '<div class="title">' + escapeAttr(recLabel(r)) + '</div>' +
          '<div class="sub">' + escapeAttr(recSummaryLine(r)) + '</div>' +
          '<div class="id-line">' + escapeAttr(r.id) + '</div>';
        li.onclick = function () {
          selectedIdx = i;
          selectedEventSeq = null;
          stopPlayback();
          syncBounds(RECORDINGS[selectedIdx]);
          updateScrubberFromT();
          buildList();
          updateHero(RECORDINGS[selectedIdx]);
          render();
        };
        listEl.appendChild(li);
      });
    }

    function escapeAttr(s) {
      return String(s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/"/g, '&quot;');
    }

    function laneIndex(topology, ev) {
      var servers = topology.servers.map(function (s) { return 'srv:' + s.id; });
      var clients = topology.clients.map(function (c) { return 'cli:' + c.id; });
      var order = servers.concat(clients);
      function idxFor(key) {
        var i = order.indexOf(key);
        return i >= 0 ? i : 0;
      }
      switch (ev.type) {
        case 'topology': return -1;
        case 'server_write':
          return idxFor('srv:' + ev.serverId);
        default:
          if ('clientId' in ev) return idxFor('cli:' + ev.clientId);
          return 0;
      }
    }

    function timeRange(rec) {
      var t0 = rec.startedAt;
      var t1 = rec.endedAt;
      for (var i = 0; i < rec.events.length; i++) {
        var e = rec.events[i];
        if (e.time < t0) t0 = e.time;
        if (e.time > t1) t1 = e.time;
      }
      if (t1 <= t0) t1 = t0 + 1;
      return { t0: t0, t1: t1 };
    }

    function evtClassFixed(t) {
      var m = {
        client_write: 'evt-write',
        push_start: 'evt-push', push_success: 'evt-push', push_fail: 'evt-fail',
        poll_start: 'evt-poll', poll_success: 'evt-poll', poll_fail: 'evt-fail',
        network_op: 'evt-net',
        remote_read: 'evt-remote', remote_write: 'evt-remote',
        partition: 'evt-part', heal: 'evt-heal',
        invalidation_scheduled: 'evt-inv', invalidation_delivered: 'evt-inv', invalidation_dropped: 'evt-inv',
        subscribe: 'evt-sub', unsubscribe: 'evt-sub',
        server_write: 'evt-server',
        sync_error: 'evt-sync-err'
      };
      return m[t] || 'evt-net';
    }

    function render() {
      var rec = RECORDINGS[selectedIdx];
      if (!rec) return;

      var topology = rec.topology;
      var servers = topology.servers;
      var clients = topology.clients;
      var laneLabels = servers.map(function (s) { return 'Server ' + s.id; }).concat(
        clients.map(function (c) { return 'Client ' + c.id; })
      );
      var laneCount = laneLabels.length;
      var tr = timeRange(rec);
      var t0 = tr.t0;
      var t1 = tr.t1;
      var duration = t1 - t0;

      var laneH = 44;
      var topPad = 36;
      var leftPad = 120;
      var rightPad = 40;
      var wTime = Math.max(800, duration * scale) + leftPad + rightPad;
      var h = topPad + laneCount * laneH + 24;

      var events = rec.events.filter(function (e) { return e.type !== 'topology'; });

      while (svg.firstChild) svg.removeChild(svg.firstChild);

      var defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
      defs.innerHTML =
        '<marker id="arrowOrange" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">' +
        '<path d="M0,0 L8,4 L0,8 z" fill="#e8943a"/></marker>' +
        '<marker id="arrowGreen" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto">' +
        '<path d="M0,0 L8,4 L0,8 z" fill="#4ecf8e"/></marker>';
      svg.appendChild(defs);

      var gRoot = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      gRoot.setAttribute('transform', 'translate(' + panX + ',' + panY + ')');
      svg.appendChild(gRoot);

      function xAt(time) {
        return leftPad + ((time - t0) / duration) * (wTime - leftPad - rightPad);
      }

      var xPlay = xAt(tPlay);
      var partState = {};
      var subs = {};

      for (var ei = 0; ei < rec.events.length; ei++) {
        var e = rec.events[ei];
        var cid = e.clientId;
        if (e.type === 'partition' && cid) partState[cid] = e.time;
        if (e.type === 'heal' && cid && partState[cid] != null) {
          var xEnd = Math.min(xAt(e.time), xPlay);
          var li = laneIndex(topology, { type: 'partition', clientId: cid });
          var y = topPad + li * laneH;
          var x0 = xAt(partState[cid]);
          if (x0 < xPlay) {
            var band = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            band.setAttribute('class', 'part-band');
            band.setAttribute('x', Math.min(x0, xEnd));
            band.setAttribute('y', y + 4);
            band.setAttribute('width', Math.abs(xEnd - Math.min(x0, xPlay)));
            band.setAttribute('height', laneH - 8);
            band.setAttribute('opacity', xAt(e.time) > xPlay ? '0.35' : '1');
            gRoot.appendChild(band);
          }
          partState[cid] = null;
        }
      }

      for (var ej = 0; ej < rec.events.length; ej++) {
        var ev2 = rec.events[ej];
        if (ev2.type === 'subscribe' && ev2.clientId) {
          subs[ev2.clientId + '|' + ev2.mode + '|' + ev2.queryKey] = ev2.time;
        }
        if (ev2.type === 'unsubscribe' && ev2.clientId) {
          var k = ev2.clientId + '|' + ev2.mode + '|' + ev2.queryKey;
          if (subs[k] != null) {
            var li2 = laneIndex(topology, ev2);
            var y2 = topPad + li2 * laneH;
            var xs0 = xAt(subs[k]);
            var xs1 = Math.min(xAt(ev2.time), xPlay);
            if (xs0 < xPlay) {
              var b2 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
              b2.setAttribute('class', 'sub-band');
              b2.setAttribute('x', Math.min(xs0, xs1));
              b2.setAttribute('y', y2 + 10);
              b2.setAttribute('width', Math.abs(xs1 - xs0));
              b2.setAttribute('height', laneH - 20);
              b2.setAttribute('opacity', xAt(ev2.time) > xPlay ? '0.4' : '1');
              gRoot.appendChild(b2);
            }
            subs[k] = null;
          }
        }
      }

      var li3;
      for (li3 = 0; li3 < laneCount; li3++) {
        var y3 = topPad + li3 * laneH;
        var rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('class', 'lane-bg');
        rect.setAttribute('x', 0);
        rect.setAttribute('y', y3);
        rect.setAttribute('width', wTime);
        rect.setAttribute('height', laneH);
        rect.setAttribute('opacity', li3 % 2 ? '0.5' : '0.35');
        gRoot.appendChild(rect);
        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('class', 'lane-line');
        line.setAttribute('x1', 0);
        line.setAttribute('x2', wTime);
        line.setAttribute('y1', y3 + laneH);
        line.setAttribute('y2', y3 + laneH);
        gRoot.appendChild(line);
        var lbl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        lbl.setAttribute('class', 'actor-label');
        lbl.setAttribute('x', 8);
        lbl.setAttribute('y', y3 + laneH / 2 + 4);
        lbl.textContent = laneLabels[li3];
        gRoot.appendChild(lbl);
      }

      var ticks = Math.min(12, Math.ceil(duration / 10) + 1);
      var ti;
      for (ti = 0; ti <= ticks; ti++) {
        var tt = t0 + (duration * ti) / ticks;
        var xx = xAt(tt);
        var ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        ln.setAttribute('class', 'time-tick');
        ln.setAttribute('x1', xx);
        ln.setAttribute('x2', xx);
        ln.setAttribute('y1', topPad - 6);
        ln.setAttribute('y2', h - 8);
        gRoot.appendChild(ln);
        var tl = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        tl.setAttribute('class', 'time-label');
        tl.setAttribute('x', xx - 12);
        tl.setAttribute('y', topPad - 10);
        tl.textContent = String(Math.round(tt - t0));
        gRoot.appendChild(tl);
      }

      var ek;
      for (ek = 0; ek < rec.events.length; ek++) {
        var e3 = rec.events[ek];
        if (e3.type === 'push_success' && e3.clientId && e3.time <= tPlay) {
          var cli = topology.clients.find(function (c) { return c.id === e3.clientId; });
          if (!cli) continue;
          var si = servers.findIndex(function (s) { return s.id === cli.serverId; });
          var ci = servers.length + topology.clients.findIndex(function (c) { return c.id === e3.clientId; });
          if (si < 0 || ci < 0) continue;
          var yS = topPad + si * laneH + laneH / 2;
          var yC = topPad + ci * laneH + laneH / 2;
          var xa = xAt(e3.time);
          var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          path.setAttribute('class', 'arrow-push');
          path.setAttribute('opacity', '0.9');
          path.setAttribute('d', 'M' + xa + ',' + yC + ' L' + xa + ',' + yS);
          gRoot.appendChild(path);
        }
        if (e3.type === 'poll_success' && e3.clientId && e3.time <= tPlay) {
          var cliP = topology.clients.find(function (c) { return c.id === e3.clientId; });
          if (!cliP) continue;
          var siP = servers.findIndex(function (s) { return s.id === cliP.serverId; });
          var ciP = servers.length + topology.clients.findIndex(function (c) { return c.id === e3.clientId; });
          if (siP < 0 || ciP < 0) continue;
          var ySp = topPad + siP * laneH + laneH / 2;
          var yCp = topPad + ciP * laneH + laneH / 2;
          var xaP = xAt(e3.time);
          var pathP = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          pathP.setAttribute('class', 'arrow-poll');
          pathP.setAttribute('opacity', '0.9');
          pathP.setAttribute('d', 'M' + xaP + ',' + ySp + ' L' + xaP + ',' + yCp);
          gRoot.appendChild(pathP);
        }
        if (e3.type === 'invalidation_delivered' && e3.clientId && e3.time <= tPlay) {
          var li4 = laneIndex(topology, e3);
          var prev = rec.events.filter(function (x) {
            return x.seq < e3.seq && x.type === 'invalidation_scheduled' && x.clientId === e3.clientId;
          });
          var sch = prev.length ? prev[prev.length - 1] : null;
          if (sch && sch.time <= tPlay) {
            var y4 = topPad + li4 * laneH + laneH / 2;
            var x0b = xAt(sch.time);
            var x1b = xAt(e3.time);
            var path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path2.setAttribute('class', 'arrow-inv');
            path2.setAttribute('d', 'M' + x0b + ',' + (y4 + 6) + ' Q' + ((x0b + x1b) / 2) + ',' + (y4 - 14) + ' ' + x1b + ',' + y4);
            gRoot.appendChild(path2);
          }
        }
      }

      var lastPastSeq = -1;
      var ex;
      for (ex = 0; ex < events.length; ex++) {
        var ev3 = events[ex];
        if (ev3.time <= tPlay) lastPastSeq = ev3.seq;
      }

      for (ex = 0; ex < events.length; ex++) {
        ev3 = events[ex];
        var li5 = laneIndex(topology, ev3);
        if (li5 < 0) continue;
        var past = ev3.time <= tPlay;
        var y5 = topPad + li5 * laneH + laneH / 2;
        var x5 = xAt(ev3.time);
        var op = past ? '1' : '0.22';
        var boost = past && selectedEventSeq === ev3.seq;
        var isFail = ev3.type === 'push_fail' || ev3.type === 'poll_fail' || ev3.type === 'sync_error';
        var isLine = ev3.type === 'partition' || ev3.type === 'heal';
        if (isLine) {
          var line2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
          line2.setAttribute('stroke', ev3.type === 'partition' ? '#f07178' : '#4ecf8e');
          line2.setAttribute('stroke-width', '2');
          line2.setAttribute('x1', x5);
          line2.setAttribute('x2', x5);
          line2.setAttribute('y1', topPad + li5 * laneH + 4);
          line2.setAttribute('y2', topPad + li5 * laneH + laneH - 4);
          line2.setAttribute('data-seq', String(ev3.seq));
          line2.setAttribute('opacity', op);
          line2.style.cursor = 'pointer';
          line2.style.transition = 'opacity var(--transition)';
          gRoot.appendChild(line2);
        } else if (isFail) {
          var txt = document.createElementNS('http://www.w3.org/2000/svg', 'text');
          txt.setAttribute('x', x5 - 5);
          txt.setAttribute('y', y5 + 4);
          txt.setAttribute('fill', '#f07178');
          txt.setAttribute('font-weight', 'bold');
          txt.setAttribute('data-seq', String(ev3.seq));
          txt.setAttribute('opacity', op);
          txt.style.cursor = 'pointer';
          txt.textContent = '✕';
          gRoot.appendChild(txt);
        } else {
          var circ = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circ.setAttribute('class', evtClassFixed(ev3.type));
          circ.setAttribute('cx', x5);
          circ.setAttribute('cy', y5);
          var r = ev3.type === 'network_op' && ev3.phase === 'begin' ? 3 : 5;
          if (past && ev3.seq === lastPastSeq && selectedEventSeq == null) {
            r += 1.5;
          }
          circ.setAttribute('r', String(r));
          if (boost) {
            circ.setAttribute('stroke', '#fff');
            circ.setAttribute('stroke-width', '2');
          }
          circ.setAttribute('data-seq', String(ev3.seq));
          circ.setAttribute('opacity', op);
          circ.style.cursor = 'pointer';
          circ.style.transition = 'opacity var(--transition), r var(--transition)';
          gRoot.appendChild(circ);
        }
      }

      var ph = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ph.setAttribute('class', 'playhead-line');
      ph.setAttribute('x1', xPlay);
      ph.setAttribute('x2', xPlay);
      ph.setAttribute('y1', topPad - 4);
      ph.setAttribute('y2', h - 4);
      gRoot.appendChild(ph);

      svg.setAttribute('width', wTime);
      svg.setAttribute('height', h);
      svg.setAttribute('viewBox', '0 0 ' + wTime + ' ' + h);

      function showDetail(seq) {
        var evFound = rec.events.find(function (x) { return x.seq === seq; });
        detailEl.textContent = evFound ? JSON.stringify(evFound, null, 2) : '';
        selectedEventSeq = seq;
        render();
      }

      function attachHitTargets() {
        var nodes = svg.querySelectorAll('[data-seq]');
        nodes.forEach(function (node) {
          node.addEventListener('click', function (ev) {
            ev.stopPropagation();
            showDetail(Number(node.getAttribute('data-seq')));
          });
          node.addEventListener('mouseenter', function () {
            var seq = Number(node.getAttribute('data-seq'));
            var e = rec.events.find(function (x) { return x.seq === seq; });
            if (!e) return;
            tooltipEl.style.display = 'block';
            tooltipEl.textContent = e.type + ' @t=' + e.time + ' seq=' + e.seq;
          });
          node.addEventListener('mouseleave', function () {
            tooltipEl.style.display = 'none';
          });
        });
      }
      attachHitTargets();

      if (selectedEventSeq != null) {
        var evSel = rec.events.find(function (x) { return x.seq === selectedEventSeq; });
        detailEl.textContent = evSel ? JSON.stringify(evSel, null, 2) : '';
      }
    }

    var isPan = false;
    var startX = 0, startY = 0, startPanX = 0, startPanY = 0;

    scrollEl.addEventListener('mousedown', function (e) {
      if (e.button !== 0) return;
      isPan = true;
      scrollEl.classList.add('panning');
      startX = e.clientX;
      startY = e.clientY;
      startPanX = panX;
      startPanY = panY;
    });
    window.addEventListener('mouseup', function () {
      isPan = false;
      scrollEl.classList.remove('panning');
    });
    window.addEventListener('mousemove', function (e) {
      if (!isPan) return;
      panX = startPanX + (e.clientX - startX);
      panY = startPanY + (e.clientY - startY);
      var g = svg.querySelector('g');
      if (g) g.setAttribute('transform', 'translate(' + panX + ',' + panY + ')');
    });
    scrollEl.addEventListener('wheel', function (e) {
      e.preventDefault();
      var d = e.deltaY > 0 ? -0.15 : 0.15;
      scale = Math.min(12, Math.max(0.3, scale * (1 + d)));
      render();
    }, { passive: false });

    document.addEventListener('mousemove', function (e) {
      if (tooltipEl.style.display === 'block') {
        tooltipEl.style.left = e.clientX + 14 + 'px';
        tooltipEl.style.top = e.clientY + 14 + 'px';
      }
    });

    document.addEventListener('keydown', function (e) {
      var el = document.activeElement;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT')) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (isPlaying) stopPlayback();
        else startPlayback();
        return;
      }
      var rec2 = RECORDINGS[selectedIdx];
      if (!rec2) return;
      var evs2 = rec2.events.filter(function (x) { return x.type !== 'topology'; });
      if (!evs2.length) return;
      var span2 = tMax - tMin;
      if (e.key === 'ArrowLeft') {
        stopPlayback();
        tPlay = Math.max(tMin, tPlay - span2 * 0.02);
        updateScrubberFromT();
        render();
      } else if (e.key === 'ArrowRight') {
        stopPlayback();
        tPlay = Math.min(tMax, tPlay + span2 * 0.02);
        updateScrubberFromT();
        render();
      }
    });

    syncBounds(RECORDINGS[0]);
    updateHero(RECORDINGS[0]);
    updateScrubberFromT();
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
