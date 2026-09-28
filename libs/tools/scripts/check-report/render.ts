/**
 * The check report as one standalone HTML document: the verdict, every
 * failure with its log, what `specs/` holds and how each spec suite fared,
 * the scenario report of every spec part that ran (the `@pkgs/harness-report`
 * document, embedded), and every gate task. No network, no external assets.
 */
import { scenarioCounts } from '@libs/harness/scenario-report';
import { REPORT_CSS, REPORT_JS } from './assets';
import {
  type CheckReport,
  countByStatus,
  type ReportTask,
  SPEC_GATE_TASKS,
  splitTaskId,
  type TaskStatus,
} from './model';
import type { DomainEntry, SpecInventory } from './spec-inventory';

export type RenderOptions = {
  readonly inventory: SpecInventory;
  /** The harness scenario report over `report.specRuns`, or null for none. */
  readonly scenarioHtml: string | null;
};

const SPEC_PART_TASK = /^test:spec:\d+$/;

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** A JSON string literal safe inside `<script type="application/json">`. */
function inlineJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

function pill(status: TaskStatus | CheckReport['verdict']): string {
  return `<span class="pill s-${status}">${status}</span>`;
}

function seconds(value: number | null): string {
  return value === null ? '' : `${value.toFixed(1)}s`;
}

function header(report: CheckReport): string {
  const rows: [string, string][] = [['report', report.id]];
  if (report.scm !== null) {
    rows.push(['commit', report.scm.sha], ['branch', report.scm.branch]);
  }
  const meta = rows
    .map(([k, v]) => `<dt>${k}</dt><dd>${escapeHtml(v)}</dd>`)
    .join('');
  const origin =
    report.origin === null
      ? ''
      : `<dt>run</dt><dd><a href="${escapeHtml(report.origin)}">${escapeHtml(report.origin)}</a></dd>`;
  return `<header><h1>bun check ${pill(report.verdict)}</h1><dl class="meta">${meta}${origin}</dl></header>`;
}

function tile(value: number, label: string): string {
  return `<div class="tile"><b>${String(value)}</b><span>${escapeHtml(label)}</span></div>`;
}

function overview(report: CheckReport): string {
  const counts = countByStatus(report.tasks);
  const scenarios = scenarioCounts(report.specRuns);
  return [
    '<section id="overview"><h2>Overview</h2><div class="tiles">',
    tile(report.tasks.length, 'gate tasks'),
    tile(counts.failed, 'failed'),
    tile(counts.passed, 'ran and passed'),
    tile(counts.cached, 'cached pass'),
    tile(counts['not-run'], 'not run'),
    tile(scenarios.passed, 'scenarios passed'),
    tile(scenarios.failed, 'scenarios failed'),
    '</div></section>',
  ].join('');
}

function logBlock(task: ReportTask, open: boolean): string {
  const body =
    task.log === null
      ? '<pre class="log muted">no log on disk for this run</pre>'
      : `<pre class="log">${escapeHtml(task.log)}</pre>`;
  return `<details${open ? ' open' : ''}><summary>${pill(task.status)} <code>${escapeHtml(task.taskId)}</code> <span class="muted">${seconds(task.seconds)}</span></summary>${body}</details>`;
}

function failedScenarios(report: CheckReport): string {
  const rows = report.specRuns.flatMap((run) =>
    run.cases
      .filter((c) => c.status === 'failed')
      .map(
        (c) =>
          `<details open><summary>${pill('failed')} ${escapeHtml(c.name)} <span class="muted">${escapeHtml(run.label)} · ${escapeHtml(c.file)}</span></summary><pre class="log">${escapeHtml(c.failure ?? '')}</pre></details>`
      )
  );
  return rows.length === 0
    ? ''
    : `<h2 class="gap">Failed scenarios</h2>${rows.join('')}`;
}

function failures(report: CheckReport): string {
  const failed = report.tasks.filter((task) => task.status === 'failed');
  const notRun = report.tasks.filter((task) => task.status === 'not-run');
  if (failed.length === 0 && notRun.length === 0) return '';
  const notRunList =
    notRun.length === 0
      ? ''
      : `<p class="muted">Not run: ${notRun.map((t) => `<code>${escapeHtml(t.taskId)}</code>`).join(', ')}</p>`;
  return `<section id="failures"><h2>Failures</h2>${failed.map((t) => logBlock(t, true)).join('')}${notRunList}${failedScenarios(report)}</section>`;
}

function domainRow(entry: DomainEntry): string {
  const scenarios = entry.features.reduce((n, f) => n + f.scenarios, 0);
  const features = entry.features
    .map(
      (f) =>
        `<div><code>${escapeHtml(f.uri)}</code> ${escapeHtml(f.name)} <span class="muted">(${String(f.scenarios)})</span></div>`
    )
    .join('');
  const models = entry.models
    .map((m) => `<div><code>${escapeHtml(m)}</code></div>`)
    .join('');
  const runners = [
    ...entry.harness.map(
      (name) => `${escapeHtml(name)} <span class="muted">check</span>`
    ),
    ...entry.live.map(
      (name) => `${escapeHtml(name)} <span class="muted">health</span>`
    ),
  ].join('<br/>');
  return `<tr><td><b>${escapeHtml(entry.domain)}</b></td><td class="num">${String(entry.features.length)}</td><td class="num">${String(scenarios)}</td><td class="num">${String(entry.models.length)}</td><td>${runners}</td><td><details><summary class="muted">specs</summary><div class="spec-list">${features}${models}</div></details></td></tr>`;
}

function suiteRows(report: CheckReport): string {
  const suites = new Map<string, ReportTask[]>();
  for (const task of report.tasks) {
    const [pkg, name] = splitTaskId(task.taskId);
    if (!SPEC_PART_TASK.test(name)) continue;
    suites.set(pkg, [...(suites.get(pkg) ?? []), task]);
  }
  return [...suites.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([pkg, parts]) => {
      const chips = parts
        .sort((a, b) => (a.taskId < b.taskId ? -1 : 1))
        .map(
          (t) =>
            `${pill(t.status)} <code>${escapeHtml(splitTaskId(t.taskId)[1])}</code>`
        )
        .join(' ');
      const runs = report.specRuns.filter((r) => r.label.startsWith(`${pkg}#`));
      const s = scenarioCounts(runs);
      const detail =
        runs.length === 0
          ? '<span class="muted">—</span>'
          : `${String(s.passed)} passed, ${String(s.failed)} failed`;
      return `<tr><td><code>${escapeHtml(pkg)}</code></td><td>${chips}</td><td>${detail}</td></tr>`;
    })
    .join('');
}

function specs(report: CheckReport, inventory: SpecInventory): string {
  const gates = report.tasks.filter((task) =>
    SPEC_GATE_TASKS.includes(task.taskId)
  );
  return [
    '<section id="specs"><h2>Specs</h2>',
    '<table><thead><tr><th>Context</th><th>Features</th><th>Scenarios</th><th>Models</th><th>Run by</th><th></th></tr></thead><tbody>',
    inventory.map(domainRow).join(''),
    '</tbody></table>',
    '<h2 class="gap">Spec gate</h2>',
    gates.map((task) => logBlock(task, task.status === 'failed')).join(''),
    '<h2 class="gap">Spec suites</h2>',
    '<p class="muted">Each package runs its contexts in parts; a cached part passed on these exact inputs. Scenario counts cover the parts this run ran or restored.</p>',
    '<table><thead><tr><th>Package</th><th>Parts</th><th>Scenarios this run</th></tr></thead><tbody>',
    suiteRows(report),
    '</tbody></table></section>',
  ].join('');
}

function scenarios(report: CheckReport, options: RenderOptions): string {
  const none =
    report.specRuns.length === 0
      ? 'No spec part ran in this run: every part is a cached pass.'
      : 'The spec parts that ran recorded no step timelines.';
  const body =
    options.scenarioHtml === null
      ? `<p class="muted">${none} <code>bun check:report --restore</code> restores every cached part's scenarios.</p>`
      : `<button id="open-scenarios" type="button">Open the scenario report</button><script id="scenario-report" type="application/json">${inlineJson(options.scenarioHtml)}</script>`;
  return `<section id="scenarios"><h2>Scenarios</h2>${body}</section>`;
}

function taskRow(task: ReportTask): string {
  return `<tr data-status="${task.status}" data-task="${escapeHtml(task.taskId.toLowerCase())}"><td>${pill(task.status)}</td><td><code>${escapeHtml(task.taskId)}</code></td><td class="num">${seconds(task.seconds)}</td><td class="mono muted">${escapeHtml(task.hash)}</td></tr>`;
}

function tasks(report: CheckReport): string {
  const options = ['failed', 'not-run', 'passed', 'cached']
    .map((s) => `<option value="${s}">${s}</option>`)
    .join('');
  return [
    '<section id="tasks"><h2>Tasks</h2>',
    `<div class="filters"><input id="task-filter" type="search" placeholder="Filter tasks"/><select id="task-status"><option value="">every status</option>${options}</select></div>`,
    '<table id="task-table"><thead><tr><th>Status</th><th>Task</th><th>Time</th><th>Turbo hash</th></tr></thead><tbody>',
    report.tasks.map(taskRow).join(''),
    '</tbody></table></section>',
  ].join('');
}

export function renderCheckReport(
  report: CheckReport,
  options: RenderOptions
): string {
  const nav = ['overview', 'failures', 'specs', 'scenarios', 'tasks']
    .map((id) => `<a href="#${id}">${id[0]?.toUpperCase()}${id.slice(1)}</a>`)
    .join('');
  return [
    '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1"/>',
    `<title>bun check ${report.verdict} · ${report.id}</title>`,
    `<style>${REPORT_CSS}</style></head><body>`,
    header(report),
    `<nav>${nav}</nav><main>`,
    overview(report),
    failures(report),
    specs(report, options.inventory),
    scenarios(report, options),
    tasks(report),
    `</main><script>${REPORT_JS}</script></body></html>`,
  ].join('\n');
}
