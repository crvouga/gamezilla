import type { SimulationReportData, SimulationStep } from './types';

/**
 * Self-contained Playwright-like HTML report (step timeline + snapshot pane).
 */
export function renderSimulationReportHtml(data: SimulationReportData): string {
  const stepsJson = JSON.stringify(data.steps.map(toClientStep));
  const metaJson = JSON.stringify({
    seed: data.meta.seed,
    ui: data.meta.ui,
    status: data.meta.status,
    durationMs: data.meta.durationMs,
    actorIds: data.meta.actorIds,
    stepCount: data.steps.length,
  });

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Simulation report — ${escapeHtml(data.meta.seed)}</title>
<style>
:root {
  --bg: #111827;
  --panel: #1f2937;
  --border: #374151;
  --text: #f3f4f6;
  --muted: #9ca3af;
  --pass: #34d399;
  --fail: #f87171;
  --accent: #60a5fa;
}
* { box-sizing: border-box; }
html, body { margin: 0; height: 100%; background: var(--bg); color: var(--text);
  font: 14px/1.4 ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif; }
header {
  display: flex; gap: 16px; align-items: center; flex-wrap: wrap;
  padding: 14px 18px; border-bottom: 1px solid var(--border); background: #0b1220;
}
header h1 { margin: 0; font-size: 16px; font-weight: 650; }
.badge {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600;
  border: 1px solid var(--border);
}
.badge.passed { color: var(--pass); border-color: #065f46; background: #052e1c; }
.badge.failed { color: var(--fail); border-color: #7f1d1d; background: #2a0f0f; }
.meta { color: var(--muted); font-size: 12px; }
.layout { display: grid; grid-template-columns: minmax(280px, 360px) 1fr; height: calc(100% - 57px); }
.steps {
  overflow: auto; border-right: 1px solid var(--border); background: var(--panel);
}
.step {
  display: block; width: 100%; text-align: left; color: inherit;
  background: transparent; border: 0; border-bottom: 1px solid var(--border);
  padding: 12px 14px; cursor: pointer;
}
.step:hover { background: #273449; }
.step.active { background: #1e3a5f; box-shadow: inset 3px 0 0 var(--accent); }
.step.failed { box-shadow: inset 3px 0 0 var(--fail); }
.step-title { font-weight: 600; margin-bottom: 4px; }
.step-sub { color: var(--muted); font-size: 12px; word-break: break-word; }
.detail { display: flex; flex-direction: column; min-width: 0; }
.detail-meta {
  padding: 12px 16px; border-bottom: 1px solid var(--border); background: #0b1220;
}
.detail-meta h2 { margin: 0 0 6px; font-size: 15px; }
.detail-meta pre {
  margin: 8px 0 0; white-space: pre-wrap; word-break: break-word;
  color: var(--fail); font-size: 12px;
}
.preview {
  flex: 1; min-height: 0; background: #0b1220; padding: 12px;
  display: flex; justify-content: center; align-items: flex-start;
  overflow: auto;
}
.preview iframe {
  width: 390px; max-width: 100%; height: 844px; min-height: 844px;
  border: 1px solid #374151; border-radius: 8px;
  background: hsla(240, 5%, 4%, 1);
}
.empty { color: var(--muted); padding: 24px; }
@media (max-width: 860px) {
  .layout { grid-template-columns: 1fr; grid-template-rows: 40% 60%; }
  .steps { border-right: 0; border-bottom: 1px solid var(--border); }
}
</style>
</head>
<body>
<header>
  <h1>Simulation report</h1>
  <span id="statusBadge" class="badge">…</span>
  <span class="meta" id="headerMeta"></span>
</header>
<div class="layout">
  <nav class="steps" id="stepList" aria-label="Steps"></nav>
  <section class="detail">
    <div class="detail-meta" id="detailMeta">
      <div class="empty">Select a step</div>
    </div>
    <div class="preview">
      <iframe id="preview" title="UI snapshot" sandbox="allow-same-origin"></iframe>
    </div>
  </section>
</div>
<script>
const meta = ${metaJson};
const steps = ${stepsJson};
const statusEl = document.getElementById('statusBadge');
statusEl.textContent = meta.status.toUpperCase();
statusEl.className = 'badge ' + meta.status;
document.getElementById('headerMeta').textContent =
  'seed ' + meta.seed +
  ' · ' + meta.ui +
  ' · ' + meta.stepCount + ' steps' +
  ' · ' + formatMs(meta.durationMs) +
  (meta.actorIds.length ? ' · actors: ' + meta.actorIds.join(', ') : '');

const list = document.getElementById('stepList');
const detailMeta = document.getElementById('detailMeta');
const preview = document.getElementById('preview');

steps.forEach((step, i) => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'step' + (step.status === 'failed' ? ' failed' : '');
  btn.dataset.index = String(i);
  btn.innerHTML =
    '<div class="step-title">' + escapeHtml(step.index + '. ' + step.title) + '</div>' +
    '<div class="step-sub">' +
      escapeHtml(step.actorId + ' · ' + step.kind + ' · ' + formatMs(step.durationMs)) +
      (step.selector ? '<br/>' + escapeHtml(step.selector) : '') +
    '</div>';
  btn.addEventListener('click', () => selectStep(i));
  list.appendChild(btn);
});

function selectStep(i) {
  const step = steps[i];
  for (const el of list.querySelectorAll('.step')) {
    el.classList.toggle('active', el.dataset.index === String(i));
  }
  detailMeta.innerHTML =
    '<h2>' + escapeHtml(step.title) + '</h2>' +
    '<div class="meta">' +
      escapeHtml(step.actorId + ' · ' + step.kind + ' · ' + step.status + ' · ' + formatMs(step.durationMs)) +
      (step.selector ? '<br/>selector: ' + escapeHtml(step.selector) : '') +
      (step.detail ? '<br/>' + escapeHtml(step.detail) : '') +
      (step.snapshotFile ? '<br/><a href="' + escapeAttr(step.snapshotFile) + '" target="_blank" rel="noreferrer">Open snapshot HTML</a>' : '') +
    '</div>' +
    (step.error ? '<pre>' + escapeHtml(step.error) + '</pre>' : '');
  preview.srcdoc = step.snapshotHtml || '<!DOCTYPE html><html><body style="font-family:sans-serif;padding:16px;color:#666">No snapshot</body></html>';
}

function formatMs(ms) {
  if (ms < 1000) return ms + 'ms';
  return (ms / 1000).toFixed(2) + 's';
}
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
function escapeAttr(s) {
  return escapeHtml(s).replace(/'/g, '&#39;');
}

if (steps.length) {
  const failed = steps.findIndex((s) => s.status === 'failed');
  selectStep(failed >= 0 ? failed : 0);
}
</script>
</body>
</html>`;
}

function toClientStep(step: SimulationStep) {
  return {
    index: step.index,
    actorId: step.actorId,
    kind: step.kind,
    title: step.title,
    selector: step.selector,
    detail: step.detail,
    status: step.status,
    durationMs: step.durationMs,
    error: step.error,
    snapshotFile: step.snapshotFile,
    snapshotHtml: step.snapshotHtml,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
