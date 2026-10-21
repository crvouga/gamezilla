import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluate } from '@libs/infra-shared/hcl-eval';
import { parseConfig } from '@libs/infra-shared/hcl-parse';
import type { Value } from '@libs/infra-shared/hcl-value';
import { sourceFiles } from '@libs/infra-shared/infra-source';

type Alert = {
  readonly name: string;
  readonly expr: string;
  readonly owner: string;
  readonly severity: string;
  readonly summary: string;
  readonly runbook: string;
};

const MODULE = join(import.meta.dirname, '../tofu/modules/observability-views');
const README = join(
  import.meta.dirname,
  '../../observability-shared/README.md'
);

/** The module's alert rules as OpenTofu renders them for one environment. */
function renderedAlerts(environment: string): Record<string, Alert> {
  const body = parseConfig(readFileSync(join(MODULE, 'alerts.tf'), 'utf8'));
  const block = body.blocks.find((b) => b.type === 'locals');
  if (block === undefined) throw new Error('alerts.tf declares no locals');
  const local: Record<string, Value> = {};
  for (const [name, expr] of block.body.attributes) {
    local[name] = evaluate(expr, {
      names: { var: { environment }, local },
      files: sourceFiles(new Map()),
    });
  }
  return local['alert_queries'] as unknown as Record<string, Alert>;
}

/** GitHub's heading anchors: lower case, punctuation dropped, spaces to dashes. */
function anchors(markdown: string): Set<string> {
  return new Set(
    [...markdown.matchAll(/^#+ (.+)$/gm)].map((m) =>
      (m[1] ?? '')
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .replaceAll(' ', '-')
    )
  );
}

test('every alert names its owner, severity and a runbook section that exists', () => {
  const alerts = renderedAlerts('example');
  const sections = anchors(readFileSync(README, 'utf8'));
  for (const alert of Object.values(alerts)) {
    expect(alert.owner.length).toBeGreaterThan(0);
    expect(['warning', 'critical']).toContain(alert.severity);
    expect(alert.summary.length).toBeGreaterThan(0);
    const [page, anchor] = alert.runbook.split('#');
    expect(page).toStartWith('https://github.com/crvouga/gamezilla/blob/main/');
    if (page?.endsWith('libs/observability-shared/README.md'))
      expect(sections).toContain(anchor ?? '');
  }
});

test('parked deliveries, a failing drain and refused billing callbacks each raise one alert per environment', () => {
  const alerts = renderedAlerts('example');
  const expectations = {
    outbox_exhausted: ['outbox_deliveries_exhausted_total', '[1h]', '> 0'],
    outbox_drain_failing: [
      'outbox_drain_runs_total',
      'app_outcome="failure"',
      '[15m]',
      '>= 3',
    ],
    billing_callbacks_refused: [
      'billing_callbacks_total',
      'app_outcome=~"unverified|failed"',
      '[1h]',
      '>= 3',
    ],
  };
  for (const [key, fragments] of Object.entries(expectations)) {
    const expr = alerts[key]?.expr ?? '';
    for (const fragment of fragments) expect(expr).toContain(fragment);
    // The series carries its environment; no resource join can drop an
    // isolate that has already ended.
    expect(expr).toContain('deployment_environment_name="example"');
    expect(expr).not.toContain('target_info');
    // Single-sample series from short-lived isolates are still counted.
    expect(expr).toContain('unless min_over_time(');
    // One series for the rule: never an alert per event or per isolate.
    expect(expr).not.toMatch(/\bby\s*\(/);
    expect(expr.split('(').length).toBe(expr.split(')').length);
  }
});
