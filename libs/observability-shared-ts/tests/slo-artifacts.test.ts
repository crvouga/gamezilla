// @io-wall-ok — reads the committed generated artifacts, OpenTofu sources and docs.
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { ENVIRONMENT_PLACEHOLDER } from '@libs/observability-shared-ts/alert-links';
import type { AlertRule } from '@libs/observability-shared-ts/alert-rule';
import { ruleKey } from '@libs/observability-shared-ts/alert-rule';
import {
  lowTrafficRules,
  silenceRules,
} from '@libs/observability-shared-ts/companion-alerts';
import {
  generateAlertRules,
  renderAlertRules,
} from '@libs/observability-shared-ts/slo-alert-rules';
import {
  metricBackedSlos,
  metricIndicatorOf,
  README_URL,
  runbookFor,
  sloAlertBundle,
  tierOf,
  tiersFor,
} from '@libs/observability-shared-ts/slo-alerts';
import { ruleIssues } from '@libs/observability-shared-ts/slo-checks';
import {
  generateGrafanaSlos,
  renderGrafanaSlos,
} from '@libs/observability-shared-ts/slo-grafana';
import { renderAlertDocuments } from '@pkgs/openslo-shared-ts/alert-yaml';
import { parseOpenSlo } from '@pkgs/openslo-shared-ts/parse';
import { objectiveFiles, REPO_ROOT, readRepoFile } from './specs';

const MODULE = 'libs/infra-shared-ts/tofu/modules/observability-views';
const RULES_FILE = `${MODULE}/alert-rules.generated.json`;
const SLOS_FILE = `${MODULE}/grafana-slos.generated.json`;
const POLICIES_FILE =
  'libs/observability-shared-ts/slo-alert-policies.openslo.yaml';
const FIX = 'bun run libs/observability-shared-ts/scripts/slo-generate.ts';

const docs = () => objectiveFiles().map((file) => file.doc);
const slos = () => metricBackedSlos(docs());
const rules = () => generateAlertRules(docs()).groups.flatMap((g) => g.rules);
const objectiveRules = () => rules().filter((r) => r.slo !== '');

// regression: grafana-alert-rules-hand-written
describe('the generated artifacts', () => {
  test(`match the objective files and catalog; fix drift with: ${FIX}`, () => {
    expect(readRepoFile(RULES_FILE)).toBe(
      renderAlertRules(generateAlertRules(docs()))
    );
    expect(readRepoFile(SLOS_FILE)).toBe(
      renderGrafanaSlos(generateGrafanaSlos(docs()))
    );
    expect(readRepoFile(POLICIES_FILE)).toBe(
      renderAlertDocuments(sloAlertBundle(docs()))
    );
  });

  test('are the same bytes however often they are generated', () => {
    expect(renderAlertRules(generateAlertRules(docs()))).toBe(
      renderAlertRules(generateAlertRules(docs()))
    );
    expect(renderGrafanaSlos(generateGrafanaSlos(docs()))).toBe(
      renderGrafanaSlos(generateGrafanaSlos(docs()))
    );
  });

  test('state their policies as OpenSLO that reads back strictly', () => {
    const parsed = parseOpenSlo(readRepoFile(POLICIES_FILE));
    if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
    const names = parsed.doc.alertPolicies.map((p) => p.name);
    expect(names).toHaveLength(
      slos().reduce((sum, slo) => sum + tiersFor(slo).length, 0)
    );
    expect(new Set(names).size).toBe(names.length);
    for (const policy of parsed.doc.alertPolicies) {
      const [jobTarget, routeTarget] = policy.notificationTargets;
      expect(jobTarget).toBe('health-job-failure');
      expect(policy.notificationTargets).toHaveLength(2);
      expect([
        'grafana-irm-page',
        'grafana-irm-push',
        'grafana-daily-digest',
      ]).toContain(routeTarget ?? '');
      expect(policy.conditions).toHaveLength(2);
      expect(policy.labels['tier']).toHaveLength(1);
    }
  });
});

describe('every Grafana SLO', () => {
  const generated = () => generateGrafanaSlos(docs()).slos;

  test('has an objective file behind it, and every judged objective has one', () => {
    expect(generated().map((s) => s.key)).toEqual(slos().map((s) => s.name));
  });

  test('is never declared by hand in OpenTofu', () => {
    const tofu = join(REPO_ROOT, 'libs/infra-shared-ts/tofu');
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          if (!name.startsWith('.')) walk(path);
        } else if (name.endsWith('.tf')) files.push(path);
      }
    };
    walk(tofu);
    const declared = files.flatMap((file) =>
      [
        ...readFileSync(file, 'utf8').matchAll(
          /resource\s+"grafana_slo"\s+"([^"]+)"/g
        ),
      ].map(([, name]) => `${file.slice(REPO_ROOT.length + 1)}:${name ?? ''}`)
    );
    expect(declared).toEqual([`${MODULE}/slos.tf:objectives`]);
    const tf = readRepoFile(`${MODULE}/slos.tf`);
    expect(tf).toContain(
      'jsondecode(file("${path.module}/grafana-slos.generated.json"))'
    );
    expect(tf).not.toMatch(/\bquery\s*=\s*"/);
  });

  test('fits Grafana: a rolling window it accepts, a target below 1, its environment and tier', () => {
    for (const slo of generated()) {
      expect(slo.window).toBe('7d');
      expect(slo.objective).toBeLessThan(1);
      expect(slo.query).toContain(ENVIRONMENT_PLACEHOLDER);
      expect(slo.query).toContain('$__rate_interval');
      expect(['0', '1', '2']).toContain(slo.labels['tier'] ?? '');
    }
  });

  test('is judged within the fourteen days the metrics backend keeps', () => {
    for (const slo of slos())
      expect(['7d', '14d']).toContain(slo.timeWindow.duration);
  });
});

describe('every alert rule', () => {
  test('carries an owner, severity, route, runbook, investigation command and environment', () => {
    expect(ruleIssues(rules())).toEqual([]);
    for (const rule of rules()) {
      expect(['critical', 'warning']).toContain(rule.severity);
      expect(['page', 'push', 'digest']).toContain(rule.route);
      expect(rule.logs_path).toStartWith('/explore?');
      expect(rule.traces_path).toStartWith('/explore?');
      expect(rule.logs_path).toContain(ENVIRONMENT_PLACEHOLDER);
      if (rule.slo !== '') expect(rule.runbook_url).toBe(runbookFor(rule.slo));
      else if (rule.covers === '')
        expect(rule.runbook_url).toStartWith(README_URL.split('#')[0] ?? '');
    }
  });

  test('pages only for a tier 0 or 1 objective, or the pipeline that measures them', () => {
    for (const rule of rules()) {
      if (rule.route !== 'page') continue;
      expect(rule.severity).toBe('critical');
      if (rule.capability !== 'pipeline')
        expect(['0', '1']).toContain(rule.tier);
    }
    const digest = rules().filter((r) => r.route === 'digest');
    expect(digest.length).toBeGreaterThan(0);
    for (const rule of digest) {
      expect(rule.tier).toBe('2');
      expect(rule.severity).toBe('warning');
    }
  });

  test('names its objective, burn threshold, budget and the budget left', () => {
    const expected = slos().reduce((sum, slo) => sum + tiersFor(slo).length, 0);
    expect(objectiveRules()).toHaveLength(expected);
    for (const rule of objectiveRules()) {
      expect(rule.burn_threshold).toBeGreaterThan(0);
      expect(rule.budget_spent).toMatch(/^\d+(\.\d)?%$/);
      expect(rule.budget_expr).toStartWith('(1 - ');
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

  test('matches its objective by label, so one objective name beginning another takes nothing of it', () => {
    for (const rule of objectiveRules()) {
      expect(
        rule.name.startsWith(
          slos().find((s) => s.name === rule.slo)?.displayName ?? '\u0000'
        )
      ).toBe(true);
    }
  });
});

describe('every objective rule', () => {
  test('is judged slice by slice when its indicator has slices', () => {
    for (const rule of objectiveRules()) {
      const indicator = metricIndicatorOf(
        slos().find((s) => s.name === rule.slo) ?? (undefined as never)
      );
      const expected =
        indicator.sliceBy === null
          ? ''
          : indicator.sliceBy.replaceAll('.', '_');
      expect(rule.slice_label).toBe(expected);
      if (expected !== '') expect(rule.expr).toContain(`sum by (${expected})`);
    }
  });
});

describe('the low-traffic rules', () => {
  const rules = () => lowTrafficRules(docs());

  test('push and page on bad events for every objective that counts them', () => {
    const counted = slos().filter(
      (slo) => metricIndicatorOf(slo).lowTraffic !== undefined
    );
    expect(rules()).toHaveLength(counted.length * 2);
    expect(counted.map((s) => s.name)).toContain('the-app-serves-people');
    for (const rule of rules()) {
      expect(['push', 'page']).toContain(rule.route);
      // Silent once traffic is enough for the burn rates to judge.
      expect(rule.expr).toContain(') and on() (');
    }
  });
});

describe('the silence rules', () => {
  test('cover every tier 0 and 1 objective exactly once, and no tier 2 one', () => {
    const covered = silenceRules(docs())
      .flatMap((r) => r.covers.split(', '))
      .sort();
    const expected = slos()
      .filter((slo) => tierOf(slo) <= 1)
      .map((slo) => slo.name)
      .sort();
    expect(covered).toEqual(expected);
  });

  test('fire on nothing counted, never on an empty answer', () => {
    for (const rule of silenceRules(docs())) {
      expect(rule.expr).toEndWith(' or vector(0)) < bool 1');
    }
  });
});

describe('a rule that would mislead', () => {
  const good: AlertRule = objectiveRules()[0] as AlertRule;

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
    const served = objectiveRules().find((r) =>
      r.expr.includes('http_server_requests_total')
    ) as AlertRule;
    const renamed = served.expr.replaceAll(
      'http_server_requests_total',
      'http_server_hits_total'
    );
    expect(
      ruleIssues([{ ...served, expr: renamed }]).some((i) =>
        i.includes(
          'selects http_server_hits_total, which no emitted metric produces'
        )
      )
    ).toBe(true);
  });

  test('that selects a label or value the series never has', () => {
    const quick = objectiveRules().find((r) =>
      r.expr.includes('le="0.5"')
    ) as AlertRule;
    const typo = quick.expr.replace(
      'app_http_route_group="sync"',
      'app_http_route="sync"'
    );
    expect(
      ruleIssues([{ ...quick, expr: typo }]).some((i) =>
        i.includes('has no label app_http_route')
      )
    ).toBe(true);
    const split = quick.expr.replaceAll(
      'by (app_http_route_group)',
      'by (app_http_route)'
    );
    expect(
      ruleIssues([{ ...quick, expr: split }]).some((i) =>
        i.includes('splits by app_http_route, which no series it reads carries')
      )
    ).toBe(true);
    const bound = quick.expr.replace('le="0.5"', 'le="0.6"');
    expect(
      ruleIssues([{ ...quick, expr: bound }]).some((i) =>
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
  const tf = readRepoFile(`${MODULE}/alerts.tf`);

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

  test('routes by the label every rule carries, from the stack-wide policy', () => {
    const routing = readRepoFile(
      'libs/infra-shared-ts/tofu/modules/alert-routing/main.tf'
    );
    for (const route of ['page', 'push', 'digest'])
      expect(routing).toContain(`"${route}"`);
    expect(routing).toContain('label = "route"');
  });
});

describe('the runbook', () => {
  const runbook = readRepoFile('docs/SLO_RUNBOOK.md');
  const coverage = readRepoFile('docs/SLO_COVERAGE.md');

  test('has a section for every judged objective, keyed by its name', () => {
    for (const slo of slos()) expect(runbook).toContain(`\n## ${slo.name}\n`);
  });

  test('and the coverage matrix names every live objective file', () => {
    for (const file of objectiveFiles().filter((f) => f.live))
      expect(coverage).toContain(file.path);
  });
});
