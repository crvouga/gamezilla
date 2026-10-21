import { describe, expect, test } from 'bun:test';
import type { AlertRule } from '@libs/observability-shared/slo-alert-rules';
import {
  ENVIRONMENT_PLACEHOLDER,
  generateAlertRules,
  renderAlertRules,
  ruleKey,
} from '@libs/observability-shared/slo-alert-rules';
import {
  RUNBOOK_URL,
  sloAlertBundle,
} from '@libs/observability-shared/slo-alerts';
import { ruleIssues } from '@libs/observability-shared/slo-checks';
import { renderAlertDocuments } from '@pkgs/openslo-shared/alert-yaml';
import { parseOpenSlo } from '@pkgs/openslo-shared/parse';
import { objectiveFiles, readRepoFile } from './specs';

const RULES_FILE =
  'libs/infra-shared/tofu/modules/observability-views/alert-rules.generated.json';
const POLICIES_FILE =
  'libs/observability-shared/slo-alert-policies.openslo.yaml';
const FIX = 'bun run libs/observability-shared/scripts/slo-generate.ts';

const docs = () => objectiveFiles().map((file) => file.doc);
const rules = () => generateAlertRules(docs()).groups.flatMap((g) => g.rules);

// regression: grafana-alert-rules-hand-written
describe('the generated alert artifacts', () => {
  test(`match the objective files and catalog; fix drift with: ${FIX}`, () => {
    expect(readRepoFile(RULES_FILE)).toBe(
      renderAlertRules(generateAlertRules(docs()))
    );
    expect(readRepoFile(POLICIES_FILE)).toBe(
      renderAlertDocuments(sloAlertBundle(docs()))
    );
  });

  test('state their policies as OpenSLO that reads back strictly', () => {
    const parsed = parseOpenSlo(readRepoFile(POLICIES_FILE));
    if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
    const names = parsed.doc.alertPolicies.map((p) => p.name);
    expect(names).toHaveLength(4 * 3);
    expect(new Set(names).size).toBe(names.length);
    for (const policy of parsed.doc.alertPolicies) {
      expect(policy.notificationTargets).toEqual([
        'health-job-failure',
        'grafana-notification-policy',
      ]);
      expect(policy.conditions).toHaveLength(2);
    }
  });
});

describe('every alert rule', () => {
  test('carries an owner, severity, runbook, investigation command and environment', () => {
    expect(ruleIssues(rules())).toEqual([]);
    for (const rule of rules()) {
      expect(['critical', 'warning']).toContain(rule.severity);
      // A pipeline alert may link its own section of the same README.
      if (rule.slo !== '') expect(rule.runbook_url).toBe(RUNBOOK_URL);
      else
        expect(rule.runbook_url).toStartWith(RUNBOOK_URL.split('#')[0] ?? '');
    }
  });

  test('names its objective, burn threshold and budget, unless it watches the pipeline', () => {
    const [pipeline, objectives] = [
      rules().filter((r) => r.slo === ''),
      rules().filter((r) => r.slo !== ''),
    ];
    expect(pipeline?.map((r) => r.key)).toEqual([
      'event-export-failures',
      'schema-rejections',
      'pipeline-absent',
      'outbox-exhausted',
      'outbox-drain-failing',
      'billing-callbacks-refused',
    ]);
    expect(objectives).toHaveLength(12);
    for (const rule of objectives ?? []) {
      expect(rule.burn_threshold).toBeGreaterThan(0);
      expect(rule.budget_spent).toMatch(/^\d+(\.\d)?%$/);
    }
  });

  test('has an identity that fits a Grafana uid beside any environment name', () => {
    const keys = rules().map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const key of keys) {
      expect(`${key}-production`.length).toBeLessThanOrEqual(40);
      expect(key).toMatch(/^[a-z0-9-]+$/);
    }
    expect(ruleKey('the-app-serves-people-fast-burn')).toBe(
      ruleKey('the-app-serves-people-fast-burn')
    );
  });

  test('is judged on its own schedule: pages every minute, the slow tiers every five', () => {
    const { groups } = generateAlertRules(docs());
    expect(groups.map((g) => [g.key, g.interval_seconds])).toEqual([
      ['fast', 60],
      ['slow', 300],
    ]);
    expect(
      groups[0]?.rules
        .filter((r) => r.slo !== '')
        .every((r) => r.name.includes('fast-burn'))
    ).toBe(true);
    expect(groups[1]?.rules.every((r) => !r.name.includes('fast-burn'))).toBe(
      true
    );
  });
});

describe('a rule that would mislead', () => {
  const good: AlertRule = rules().find((r) => r.slo !== '') as AlertRule;

  test('without an owner, runbook or command', () => {
    const issues = ruleIssues([
      { ...good, owner: '', runbook_url: ' ', investigate_command: '' },
    ]);
    expect(issues.some((i) => i.includes('has no owner'))).toBe(true);
    expect(issues.some((i) => i.includes('has no runbook_url'))).toBe(true);
    expect(issues.some((i) => i.includes('has no investigate_command'))).toBe(
      true
    );
  });

  test('with a command that is not bun obs', () => {
    expect(
      ruleIssues([{ ...good, investigate_command: 'open grafana' }])[0]
    ).toContain('must be a bun obs command');
  });

  test('that does not select its environment', () => {
    const without = good.expr.replaceAll(ENVIRONMENT_PLACEHOLDER, 'prd');
    expect(ruleIssues([{ ...good, expr: without }])[0]).toContain(
      'does not select its environment'
    );
  });

  test('that reads a metric nobody emits', () => {
    const renamed = good.expr.replaceAll(
      'http_server_request_duration_seconds',
      'http_server_latency_seconds'
    );
    expect(
      ruleIssues([{ ...good, expr: renamed }]).some((i) =>
        i.includes(
          'selects http_server_latency_seconds_bucket, which no emitted metric produces'
        )
      )
    ).toBe(true);
  });

  test('that selects a label or value the series never has', () => {
    const typo = good.expr.replace('app_http_route_group', 'app_http_route');
    expect(
      ruleIssues([{ ...good, expr: typo }]).some((i) =>
        i.includes('has no label app_http_route')
      )
    ).toBe(true);
    const bound = good.expr.replace('le="0.5"', 'le="0.6"');
    expect(
      ruleIssues([{ ...good, expr: bound }]).some((i) =>
        i.includes('{le} is never "0.6"')
      )
    ).toBe(true);
  });

  test('declared twice', () => {
    expect(
      ruleIssues([good, good]).some((i) => i.includes('is declared twice'))
    ).toBe(true);
  });
});

describe('the OpenTofu module', () => {
  const tf = readRepoFile(
    'libs/infra-shared/tofu/modules/observability-views/alerts.tf'
  );

  test('reads the generated rules and no hand-written expression', () => {
    expect(tf).toContain(
      'jsondecode(file("${path.module}/alert-rules.generated.json"))'
    );
    expect(tf).toContain(
      'replace(rule.value.expr, "__ENVIRONMENT__", var.environment)'
    );
    expect(tf).not.toMatch(/\bexpr\s*=\s*"/);
    expect(tf).not.toContain('http_server_requests_total');
  });

  test('keeps the address the first group had, so applying updates it in place', () => {
    expect(tf).toContain('from = grafana_rule_group.this');
    expect(tf).toContain('to   = grafana_rule_group.groups["fast"]');
    const fast = generateAlertRules(docs()).groups[0];
    expect(fast?.name).toBe('Business observability');
  });
});
