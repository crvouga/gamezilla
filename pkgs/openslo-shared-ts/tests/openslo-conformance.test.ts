import { describe, expect, test } from 'bun:test';
import { standardAlerts } from '@pkgs/openslo-shared-ts/alert-policy';
import { renderAlertDocuments } from '@pkgs/openslo-shared-ts/alert-yaml';
import { parseOpenSlo } from '@pkgs/openslo-shared-ts/parse';
import { AND_CONDITIONS_ANNOTATION } from '@pkgs/openslo-shared-ts/parse-alert';
import { objective, slo } from './objectives';

// What the reference CLI (`oslo validate`) refuses, this reader refuses too,
// so a file the repository accepts is a file every OpenSLO tool accepts.
const SLI = `apiVersion: openslo/v1
kind: SLI
metadata:
  name: delivered
spec:
  ratioMetric:
    counter: true
    good:
      metricSource: { type: product, spec: { measures: delivered } }
    total:
      metricSource: { type: product, spec: { measures: sent } }
`;

const sloWith = (metadata: string) => `${SLI}---
apiVersion: openslo/v1
kind: SLO
metadata:
${metadata}
spec:
  service: sync-engine
  indicatorRef: delivered
  timeWindow:
    - duration: 7d
      isRolling: true
  budgetingMethod: Occurrences
  objectives:
    - displayName: most
      target: 0.99
`;

const issues = (text: string) => {
  const parsed = parseOpenSlo(text);
  return parsed.ok ? [] : parsed.issues;
};

describe('an objective file other OpenSLO tools refuse', () => {
  test('a display name longer than 63 characters', () => {
    expect(
      issues(
        sloWith(`  name: delivery\n  displayName: ${'x'.repeat(64)}`)
      ).join()
    ).toContain('must be at most 63 characters');
    expect(
      issues(sloWith(`  name: delivery\n  displayName: ${'x'.repeat(63)}`))
    ).toEqual([]);
  });

  test('a label key with a slash', () => {
    expect(
      issues(
        sloWith('  name: delivery\n  labels:\n    example.dev/tier: "0"')
      ).join()
    ).toContain('no "/"');
    expect(
      issues(sloWith('  name: delivery\n  labels:\n    example.dev.tier: "0"'))
    ).toEqual([]);
  });
});

describe('a multi-window policy', () => {
  const one = slo({
    name: 'delivery',
    objectives: [objective({ target: 0.99 })],
  });
  const bundle = standardAlerts({
    slo: one,
    targets: [
      { name: 'team', displayName: null, description: null, target: 'grafana' },
    ],
  });
  const text = renderAlertDocuments(bundle);

  test('names one condition, as OpenSLO allows, and the rest in an annotation', () => {
    expect(text).toContain(
      `${AND_CONDITIONS_ANNOTATION}: delivery-fast-burn-over-5m`
    );
    expect(text.match(/conditionRef:/g)).toHaveLength(bundle.policies.length);
  });

  test('reads back with every condition it fires on', () => {
    const parsed = parseOpenSlo(text);
    if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
    expect(parsed.doc.alertPolicies.map((p) => p.conditions)).toEqual(
      bundle.policies.map((p) => p.conditions)
    );
    expect(parsed.doc.alertPolicies[0]?.labels['severity']).toEqual(['page']);
  });

  test('naming two conditions in spec.conditions is refused, with where the second goes', () => {
    const twice = text.replace(
      '    - conditionRef: delivery-fast-burn-over-1h',
      '    - conditionRef: delivery-fast-burn-over-1h\n    - conditionRef: delivery-fast-burn-over-5m'
    );
    expect(issues(twice).join()).toContain(AND_CONDITIONS_ANNOTATION);
  });
});
