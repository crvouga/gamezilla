import { describe, expect, test } from 'bun:test';
import {
  STANDARD_BURN_TIERS,
  standardAlerts,
} from '@pkgs/openslo-shared-ts/alert-policy';
import { renderAlertDocuments } from '@pkgs/openslo-shared-ts/alert-yaml';
import { parseOpenSlo } from '@pkgs/openslo-shared-ts/parse';

type Doc = Record<string, unknown>;

const condition = (name = 'burning', spec: Doc = {}): Doc => ({
  apiVersion: 'openslo/v1',
  kind: 'AlertCondition',
  metadata: { name },
  spec: {
    severity: 'page',
    condition: {
      kind: 'burnrate',
      op: 'gte',
      threshold: 14.4,
      lookbackWindow: '1h',
    },
    ...spec,
  },
});

const target = (name = 'on-call'): Doc => ({
  apiVersion: 'openslo/v1',
  kind: 'AlertNotificationTarget',
  metadata: { name },
  spec: { target: 'pager' },
});

const policy = (name = 'page-me', spec: Doc = {}): Doc => ({
  apiVersion: 'openslo/v1',
  kind: 'AlertPolicy',
  metadata: { name },
  spec: {
    alertWhenNoData: false,
    alertWhenResolved: true,
    alertWhenBreaching: true,
    conditions: [{ conditionRef: 'burning' }],
    notificationTargets: [{ targetRef: 'on-call' }],
    ...spec,
  },
});

const sli: Doc = {
  apiVersion: 'openslo/v1',
  kind: 'SLI',
  metadata: { name: 'served' },
  spec: {
    ratioMetric: {
      counter: true,
      good: { metricSource: { type: 'product', spec: { measures: 'good' } } },
      total: { metricSource: { type: 'product', spec: { measures: 'all' } } },
    },
  },
};

const slo = (spec: Doc = {}, window = '28d'): Doc => ({
  apiVersion: 'openslo/v1',
  kind: 'SLO',
  metadata: { name: 'served-well' },
  spec: {
    service: 'runtime',
    indicatorRef: 'served',
    timeWindow: [{ duration: window, isRolling: true }],
    budgetingMethod: 'Occurrences',
    objectives: [{ displayName: 'nearly all', target: 0.999 }],
    alertPolicies: [{ alertPolicyRef: 'page-me' }],
    ...spec,
  },
});

const yaml = (...docs: readonly Doc[]) =>
  docs.map((d) => JSON.stringify(d)).join('\n---\n');

const parse = (...docs: readonly Doc[]) => parseOpenSlo(yaml(...docs));
const issuesOf = (...docs: readonly Doc[]): readonly string[] => {
  const parsed = parse(...docs);
  return parsed.ok ? [] : parsed.issues;
};

const complete = [sli, slo(), policy(), condition(), target()];

describe('alert documents', () => {
  test('are read with their references resolved by name', () => {
    const parsed = parse(...complete);
    if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
    expect(parsed.doc.slos[0]?.alertPolicies).toEqual(['page-me']);
    expect(parsed.doc.alertConditions[0]).toMatchObject({
      name: 'burning',
      severity: 'page',
      op: 'gte',
      threshold: 14.4,
      lookbackWindow: '1h',
      alertAfter: null,
    });
    expect(parsed.doc.alertPolicies[0]).toMatchObject({
      conditions: ['burning'],
      notificationTargets: ['on-call'],
      alertWhenResolved: true,
    });
    expect(parsed.doc.alertNotificationTargets[0]?.target).toBe('pager');
  });

  test('may stand alone, without the SLO they defend', () => {
    expect(parse(policy(), condition(), target()).ok).toBe(true);
  });

  test('read labels as text or lists of text', () => {
    const labelled = {
      ...policy(),
      metadata: {
        name: 'page-me',
        labels: { slo: 'served-well', team: ['a', 'b'] },
      },
    };
    const parsed = parse(labelled, condition(), target());
    if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
    expect(parsed.doc.alertPolicies[0]?.labels).toEqual({
      slo: ['served-well'],
      team: ['a', 'b'],
    });
  });
});

const BAD: readonly (readonly [string, readonly Doc[], string])[] = [
  [
    'a condition that is not a burn rate',
    [condition('burning', { condition: { kind: 'threshold' } })],
    'condition.kind must be burnrate, got "threshold"',
  ],
  [
    'a threshold that is not a positive number',
    [
      condition('burning', {
        condition: {
          kind: 'burnrate',
          op: 'gte',
          threshold: 0,
          lookbackWindow: '1h',
        },
      }),
    ],
    'condition.threshold must be a positive number, got 0',
  ],
  [
    'a lookback that is not a duration',
    [
      condition('burning', {
        condition: {
          kind: 'burnrate',
          op: 'gte',
          threshold: 2,
          lookbackWindow: 'soon',
        },
      }),
    ],
    'lookbackWindow "soon" must be a positive whole number',
  ],
  [
    'an operator that does not exist',
    [
      condition('burning', {
        condition: {
          kind: 'burnrate',
          op: 'about',
          threshold: 2,
          lookbackWindow: '1h',
        },
      }),
    ],
    'op must be one of lt, lte, gt, gte, got "about"',
  ],
  [
    'a condition with no severity',
    [condition('burning', { severity: undefined })],
    'severity is missing',
  ],
  [
    'a target with nowhere to send',
    [{ ...target(), spec: {} }],
    'AlertNotificationTarget on-call: target is missing',
  ],
  [
    'a policy with no conditions',
    [policy('page-me', { conditions: [] })],
    'conditions must be a non-empty list',
  ],
  [
    'a policy with an inline condition',
    [policy('page-me', { conditions: [{ kind: 'AlertCondition' }] })],
    'conditions[0] must be { conditionRef: <name> } (inline definitions are not read)',
  ],
  [
    'a policy that forgets whether it alerts on no data',
    [policy('page-me', { alertWhenNoData: undefined })],
    'alertWhenNoData is missing',
  ],
  [
    'a policy naming a condition that is not there',
    [policy('page-me', { conditions: [{ conditionRef: 'gone' }] }), target()],
    'AlertPolicy page-me: conditionRef "gone" names no AlertCondition in this file',
  ],
  [
    'a policy naming a target that is not there',
    [policy(), condition()],
    'AlertPolicy page-me: targetRef "on-call" names no AlertNotificationTarget in this file',
  ],
  [
    'an SLO naming a policy that is not there',
    [sli, slo({ alertPolicies: [{ alertPolicyRef: 'gone' }] })],
    'SLO served-well: alertPolicyRef "gone" names no AlertPolicy in this file',
  ],
  [
    'a condition that looks back further than the SLO window',
    [
      sli,
      slo({}, '1d'),
      policy(),
      condition('burning', {
        condition: {
          kind: 'burnrate',
          op: 'gte',
          threshold: 1,
          lookbackWindow: '3d',
        },
      }),
      target(),
    ],
    "lookbackWindow 3d is longer than the SLO's 1d window",
  ],
  [
    'a condition that waits longer than it looks back',
    [
      sli,
      slo(),
      policy(),
      condition('burning', {
        condition: {
          kind: 'burnrate',
          op: 'gte',
          threshold: 1,
          lookbackWindow: '5m',
          alertAfter: '1h',
        },
      }),
      target(),
    ],
    'alertAfter 1h is longer than lookbackWindow 5m',
  ],
  [
    'two policies of one name',
    [policy(), policy(), condition(), target()],
    'AlertPolicy page-me is declared twice',
  ],
  [
    'two conditions of one name',
    [condition(), condition(), target(), policy()],
    'AlertCondition burning is declared twice',
  ],
];

describe('issues', () => {
  test.each(BAD)('%s is reported', (_name, docs, issue) => {
    expect(issuesOf(...docs).some((i) => i.includes(issue))).toBe(true);
  });
});

describe('the standard alerts written as OpenSLO', () => {
  const slos = parse(sli, slo({ alertPolicies: undefined }));
  if (!slos.ok) throw new Error(slos.issues.join('\n'));
  const served = slos.doc.slos[0];
  if (served === undefined) throw new Error('no slo');
  const bundle = standardAlerts({
    slo: served,
    targets: [
      {
        name: 'job-failure',
        displayName: null,
        description: 'The hourly check fails.',
        target: 'ci',
      },
    ],
  });

  test('read back as exactly the policies, conditions and targets that were written', () => {
    const text = renderAlertDocuments(bundle);
    const back = parseOpenSlo(text);
    if (!back.ok) throw new Error(back.issues.join('\n'));
    expect(back.doc.alertPolicies).toEqual([...bundle.policies]);
    expect(back.doc.alertConditions).toEqual([...bundle.conditions]);
    expect(back.doc.alertNotificationTargets).toEqual([...bundle.targets]);
  });

  test('are the same text every time', () => {
    expect(renderAlertDocuments(bundle)).toBe(renderAlertDocuments(bundle));
    expect(renderAlertDocuments(bundle).split('\n---\n')).toHaveLength(
      1 + 2 * STANDARD_BURN_TIERS.length + STANDARD_BURN_TIERS.length
    );
  });
});
