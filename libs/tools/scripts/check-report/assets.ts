/** Inline stylesheet and script of the standalone check report. */

export const REPORT_CSS = `
:root { color-scheme: light dark; --fg:#1b1f24; --muted:#59636e; --bg:#fff;
  --panel:#f6f8fa; --line:#d1d9e0; --pass:#1a7f37; --fail:#cf222e;
  --cache:#0969da; --skip:#9a6700; font: 14px/1.5 system-ui, sans-serif; }
@media (prefers-color-scheme: dark) { :root { --fg:#e6edf3; --muted:#9198a1;
  --bg:#0d1117; --panel:#151b23; --line:#3d444d; --pass:#3fb950;
  --fail:#f85149; --cache:#4493f8; --skip:#d29922; } }
* { box-sizing: border-box; }
body { margin: 0; color: var(--fg); background: var(--bg); }
header, main > section { padding: 16px 24px; }
header { border-bottom: 1px solid var(--line); background: var(--panel); }
h1 { margin: 0 0 8px; font-size: 20px; display: flex; gap: 12px; align-items: center; }
h2 { font-size: 16px; margin: 0 0 12px; }
h2.gap { margin-top: 20px; }
.spec-list { padding: 0 12px 8px; }
dl.meta { display: grid; grid-template-columns: max-content 1fr; gap: 2px 12px; margin: 0; color: var(--muted); }
dl.meta dd { margin: 0; font-family: ui-monospace, monospace; color: var(--fg); }
nav { position: sticky; top: 0; z-index: 1; display: flex; gap: 16px; padding: 8px 24px;
  background: var(--bg); border-bottom: 1px solid var(--line); }
nav a { color: var(--muted); text-decoration: none; }
nav a:hover { color: var(--fg); }
.pill { display: inline-block; padding: 1px 10px; border-radius: 999px; font-size: 12px;
  font-weight: 600; color: #fff; }
.s-passed { background: var(--pass); } .s-failed { background: var(--fail); }
.s-cached { background: var(--cache); } .s-not-run, .s-incomplete { background: var(--skip); }
.tiles { display: flex; flex-wrap: wrap; gap: 12px; }
.tile { min-width: 120px; padding: 10px 14px; border: 1px solid var(--line); border-radius: 8px; }
.tile b { display: block; font-size: 22px; }
.tile span { color: var(--muted); font-size: 12px; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: 4px 8px; border-bottom: 1px solid var(--line); vertical-align: top; }
th { color: var(--muted); font-weight: 600; font-size: 12px; }
td.num { text-align: right; font-variant-numeric: tabular-nums; }
code, .mono { font-family: ui-monospace, monospace; font-size: 12px; }
details { border: 1px solid var(--line); border-radius: 8px; margin: 0 0 8px; }
details > summary { cursor: pointer; padding: 8px 12px; }
pre.log { margin: 0; padding: 12px; max-height: 480px; overflow: auto; background: var(--panel);
  border-top: 1px solid var(--line); font-size: 12px; white-space: pre-wrap; }
.muted { color: var(--muted); }
.filters { display: flex; gap: 8px; margin: 0 0 12px; }
.filters input { flex: 1; }
.filters input, .filters select, button { font: inherit; padding: 4px 8px; color: var(--fg);
  background: var(--bg); border: 1px solid var(--line); border-radius: 6px; }
button { cursor: pointer; }
iframe.scenarios { width: 100%; height: 85vh; border: 1px solid var(--line); border-radius: 8px; }
`;

/**
 * Task filter, and the scenario report loaded into its iframe on demand (it
 * is a whole document; parsing it up front would slow the first paint).
 */
export const REPORT_JS = `
(() => {
  const input = document.getElementById('task-filter');
  const status = document.getElementById('task-status');
  const rows = [...document.querySelectorAll('#task-table tbody tr')];
  const apply = () => {
    const text = input.value.trim().toLowerCase();
    for (const row of rows) {
      const show = (status.value === '' || row.dataset.status === status.value)
        && (text === '' || row.dataset.task.includes(text));
      row.hidden = !show;
    }
  };
  input?.addEventListener('input', apply);
  status?.addEventListener('change', apply);
  const button = document.getElementById('open-scenarios');
  button?.addEventListener('click', () => {
    const doc = JSON.parse(document.getElementById('scenario-report').textContent);
    const frame = document.createElement('iframe');
    frame.className = 'scenarios';
    frame.title = 'Scenario report';
    frame.srcdoc = doc;
    button.replaceWith(frame);
  });
})();
`;
