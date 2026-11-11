// @io-wall-ok — reads the declarative resources; templates run in process.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Template } from '@huggingface/jinja';
import { type Env, evaluate } from '@libs/infra-shared-ts/hcl-eval';
import { parseConfig } from '@libs/infra-shared-ts/hcl-parse';
import type { Value } from '@libs/infra-shared-ts/hcl-value';
import { sourceFiles } from '@libs/infra-shared-ts/infra-source';

type Body = ReturnType<typeof parseConfig>['blocks'][number]['body'];

function moduleTemplates(file: string, integrationName: string) {
  const config = parseConfig(
    readFileSync(
      join(import.meta.dir, '../tofu/modules/alert-routing', file),
      'utf8'
    )
  );
  const local: Record<string, Value> = {};
  const env: Env = {
    names: { local, var: { brand_name: 'X' } },
    files: sourceFiles(new Map()),
  };
  for (const block of config.blocks.filter((b) => b.type === 'locals')) {
    for (const [name, expression] of block.body.attributes) {
      local[name] = evaluate(expression, env);
    }
  }
  const integration = config.blocks.find(
    (b) =>
      b.labels[0] === 'grafana_oncall_integration' &&
      b.labels[1] === integrationName
  );
  if (integration === undefined) throw new Error(`no ${integrationName}`);
  const templates = integration.body.blocks.find(
    (b) => b.type === 'templates'
  )?.body;
  if (templates === undefined) throw new Error('no templates');
  const nested = (name: string): Body => {
    const body = templates.blocks.find((b) => b.type === name)?.body;
    if (body === undefined) throw new Error(`no ${name}`);
    return body;
  };
  return (path: string, payload: object): string => {
    const [first, second] = path.split('.');
    const body = second === undefined ? templates : nested(first ?? '');
    const expression = body.attributes.get(second ?? first ?? '');
    if (expression === undefined) throw new Error(`no ${path}`);
    return new Template(String(evaluate(expression, env)))
      .render({ payload })
      .trim();
  };
}

const GRAFANA = 'https://stack.grafana.net';
const annotations = {
  summary: 'page: People can sign in is failing its checks',
  runbook_url:
    'https://github.com/o/r/blob/main/docs/SLO_RUNBOOK.md#people-can-sign-in',
  investigate_command: 'bun obs errors --since 12h --source prod',
  logs_url: `${GRAFANA}/explore?logs`,
  traces_url: `${GRAFANA}/explore?traces`,
  dashboard_url: `${GRAFANA}/d/slo-sign-in`,
  slice: 'sign-in-check',
  burn_threshold: '10x',
  burn_rate: '14.2x',
  budget_remaining: '12%',
};
const labels = {
  alertname: 'People can sign in: fast-burn (page)',
  environment: 'prd',
  owner: 'auth',
  severity: 'critical',
  route: 'page',
  capability: 'auth',
  slo: 'people-can-sign-in',
  tier: '0',
};
const grafanaPayload = {
  status: 'firing',
  commonLabels: labels,
  commonAnnotations: annotations,
  alerts: [
    {
      status: 'firing',
      labels,
      annotations,
      startsAt: '2026-11-10T04:00:00Z',
      generatorURL: `${GRAFANA}/alerting/grafana/slo-bf57251a-prd/view`,
      silenceURL: `${GRAFANA}/alerting/silence/new`,
    },
  ],
};

const alerts = moduleTemplates('main.tf', 'alerts');

test('a Grafana alert notification names where it fired and links every place to look', () => {
  expect(alerts('web.title', grafanaPayload)).toBe(
    '[prd] People can sign in: fast-burn (page) · sign-in-check'
  );
  const message = alerts('web.message', grafanaPayload);
  for (const line of [
    `runbook: ${annotations.runbook_url}`,
    `dashboard: ${annotations.dashboard_url}`,
    `error_logs: ${annotations.logs_url}`,
    `failed_traces: ${annotations.traces_url}`,
    `alert_rule: ${GRAFANA}/alerting/grafana/slo-bf57251a-prd/view`,
    `silence: ${GRAFANA}/alerting/silence/new`,
    'environment: prd · capability: auth · owner: auth · severity: critical · route: page',
    'objective: people-can-sign-in (tier 0) · burn_rate: 14.2x (fires at 10x) · budget_remaining: 12% · slice: sign-in-check',
    `1. ${annotations.investigate_command}`,
  ]) {
    expect(message.split('\n')).toContain(line);
  }
  expect(message.startsWith(`**${annotations.summary}**`)).toBe(true);
  expect(alerts('source_link', grafanaPayload)).toBe(annotations.dashboard_url);
  const mobile = alerts('mobile_app.message', grafanaPayload);
  expect(mobile).toContain(annotations.runbook_url);
  expect(mobile).toContain(annotations.dashboard_url);
});

test('an alert without a dashboard still links its runbook, and a bare payload renders', () => {
  const { dashboard_url: _, ...rest } = annotations;
  const payload = {
    ...grafanaPayload,
    alerts: [{ ...grafanaPayload.alerts[0], annotations: rest }],
  };
  expect(alerts('source_link', payload)).toBe(annotations.runbook_url);
  expect(alerts('web.title', {})).toBe('[unknown] Alert');
  expect(alerts('web.message', {})).toContain('next (copy and run):');
});

const ci = moduleTemplates('ci.tf', 'ci');
const run = {
  action: 'completed',
  repository: {
    id: 1,
    full_name: 'o/r',
    html_url: 'https://github.com/o/r',
  },
  workflow_run: {
    id: 42,
    run_attempt: 2,
    path: '.github/workflows/deploy.yml',
    name: 'Release',
    head_branch: 'main',
    head_sha: 'abc123',
    event: 'push',
    conclusion: 'failure',
    html_url: 'https://github.com/o/r/actions/runs/42',
  },
};

test('a CI failure notification links the run, commit and playbook and says what to run first', () => {
  expect(ci('web.title', run)).toBe('Release: failure');
  const message = ci('web.message', run);
  for (const line of [
    '**Release failure** on o/r main (push, attempt 2)',
    'run: https://github.com/o/r/actions/runs/42',
    'commit: https://github.com/o/r/commit/abc123',
    'workflow_file: https://github.com/o/r/blob/main/.github/workflows/deploy.yml',
    'playbook: https://github.com/o/r/blob/main/.agents/skills/ci-workflows-green/SKILL.md',
    '2. gh run view 42 --repo o/r --log-failed | tail -200',
  ]) {
    expect(message.split('\n')).toContain(line);
  }
  for (const fragment of ['gh run rerun 42 --repo o/r --failed']) {
    expect(message).toContain(fragment);
  }
  expect(message).toContain(
    `1. gh run view 42 --repo o/r --json jobs --jq '.jobs[] | select(.conclusion == "failure") | {name, url}'`
  );
  const mobile = ci('mobile_app.message', run);
  expect(mobile).toContain('https://github.com/o/r/actions/runs/42');
  expect(mobile).toContain('https://github.com/o/r/commit/abc123');
});
