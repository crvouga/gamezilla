/**
 * Work items as people read them (Markdown: the Health job summary, the
 * uploaded artifact, `bun alerts`) and as the job log carries them: one
 * marker line, `HEALTH_ALERTS_V1 <base64 JSON>`, that `bun alerts` finds with
 * nothing but `gh` (CI keeps no GitHub Actions artifact, and the CI
 * artifacts bucket needs the secret store).
 */

import type {
  AlertEvidence,
  WorkItem,
  WorkItemsDocument,
} from './alert-work-items';
import { redact } from './alert-work-items';

export const LOG_MARKER = 'HEALTH_ALERTS_V1';

export function encodeLogBlock(doc: WorkItemsDocument): string {
  return `${LOG_MARKER} ${Buffer.from(JSON.stringify(doc), 'utf8').toString('base64')}`;
}

export function isWorkItemsDocument(
  value: unknown
): value is WorkItemsDocument {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    v['version'] === 1 &&
    Array.isArray(v['items']) &&
    Array.isArray(v['environments']) &&
    typeof v['generatedAt'] === 'string'
  );
}

/** The last work-items document a job log carries, or `null`. */
export function decodeLogBlock(log: string): WorkItemsDocument | null {
  const lines = log.split('\n');
  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i] ?? '';
    const at = line.indexOf(`${LOG_MARKER} `);
    if (at === -1) continue;
    const payload = line.slice(at + LOG_MARKER.length + 1).trim();
    try {
      const parsed: unknown = JSON.parse(
        Buffer.from(payload, 'base64').toString('utf8')
      );
      if (isWorkItemsDocument(parsed)) return parsed;
    } catch {
      // A line that only looks like the marker; keep looking.
    }
  }
  return null;
}

function percent(share: number | null): string {
  return share === null
    ? 'unknown'
    : `${String(Number((share * 100).toPrecision(6)))}%`;
}

function evidenceLines(evidence: AlertEvidence): readonly string[] {
  const lines = [
    `- Query: \`${evidence.command ?? 'none'}\` → ${evidence.status}${evidence.note === null ? '' : ` (${evidence.note})`}`,
  ];
  if (evidence.routes.length > 0) {
    lines.push('- Routes (traces, with errors, slowest):');
    for (const r of evidence.routes.slice(0, 10))
      lines.push(
        `  - \`${r.route}\`: ${String(r.traces)} traces, ${String(r.errorTraces)} with errors, slowest ${String(Math.round(r.slowestMs))} ms`
      );
  }
  if (evidence.messages.length > 0) {
    lines.push('- Error messages (count):');
    for (const m of evidence.messages.slice(0, 10))
      lines.push(`  - ${String(m.count)}× \`${m.message}\``);
  }
  if (evidence.traces.length > 0) {
    lines.push('- Example traces:');
    for (const t of evidence.traces)
      lines.push(
        `  - \`${t.traceId}\` \`${t.route}\` ${String(Math.round(t.durationMs))} ms, ${String(t.errorCount)} errors, ${t.startedAt}`
      );
  }
  for (const note of evidence.truncated) lines.push(`- Truncated: ${note}`);
  return lines;
}

function numbersLines(item: WorkItem): readonly string[] {
  const n = item.numbers;
  return [
    `- Window: ${n.window}; target ${percent(n.target)}; observed ${percent(n.observed)}${n.considered === null ? '' : ` over ${String(n.considered)} events`}`,
    `- Error budget left: ${percent(n.budgetRemaining)}`,
    ...n.burnRates.map(
      (b) =>
        `- Burn ${b.burn === null ? 'n/a' : `${String(Number(b.burn.toPrecision(4)))}x`} over ${b.lookbackWindow} (fires at ${String(b.threshold)}x, ${String(b.events)} events) — ${b.policy}`
    ),
  ];
}

/** A command in code style; a sentence as it is. */
function step(text: string): string {
  return /^(bun|gh|SECRETS_ENV=)\b/.test(text) ? `- \`${text}\`` : `- ${text}`;
}

export function renderWorkItem(item: WorkItem): string {
  return [
    `### ${item.id} — ${item.title}`,
    '',
    item.whatIsBroken,
    '',
    `- Environment: ${item.environment}`,
    `- Objective file: \`${item.specUri}\``,
    `- Owner: ${item.owner ?? 'unknown'}`,
    `- Runbook: ${item.runbook ?? 'none'}`,
    '',
    '**Numbers**',
    '',
    ...numbersLines(item),
    '',
    '**Failing checks**',
    '',
    ...item.checks.map(
      (c) =>
        `- \`${c.id}\`${c.severity === null ? '' : ` (${c.severity})`}: ${c.detail}`
    ),
    '',
    '**Evidence**',
    '',
    ...evidenceLines(item.evidence),
    '',
    '**Inspect**',
    '',
    ...item.inspect.map(step),
    '',
    '**Proves it fixed**',
    '',
    ...item.provesFixed.map(step),
    '',
  ].join('\n');
}

export function renderWorkItems(doc: WorkItemsDocument): string {
  const head = `## Open alerts (${String(doc.items.length)}) — ${doc.environments.join(', ') || 'no environments'}, ${doc.generatedAt}`;
  if (doc.items.length === 0)
    return `${head}\n\nEvery objective is met and no alert is firing.\n`;
  return redact(
    [
      head,
      '',
      ...doc.items.map((i) => `- \`${i.id}\` — ${i.whatIsBroken}`),
      '',
      ...doc.items.map(renderWorkItem),
    ].join('\n')
  );
}
