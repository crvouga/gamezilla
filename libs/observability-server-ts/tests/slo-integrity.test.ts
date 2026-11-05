import { expect, test } from 'bun:test';
import { generateAlertRules } from '@libs/observability-server-ts/slo-alert-rules';
import { sloAlerts, tiersFor } from '@libs/observability-server-ts/slo-alerts';
import { generateGrafanaSlos } from '@libs/observability-server-ts/slo-grafana';
import type { OpenSloDoc } from '@pkgs/openslo-shared-ts/model';
import { objectiveFiles } from './specs';

function integrityDocument(): OpenSloDoc {
  const file = objectiveFiles().find((file) =>
    file.path.endsWith('request-success.openslo.yaml')
  );
  const slo = file?.doc.slos[0];
  const objective = slo?.objectives[0];
  if (file === undefined || slo === undefined || objective === undefined)
    throw new Error('Missing fixture');
  return {
    ...file.doc,
    slos: [{ ...slo, objectives: [{ ...objective, target: 1 }] }],
  };
}

// regression: slo-zero-budget-divides-by-zero
test('zero-tolerance objectives page directly without an error budget or traffic floor', () => {
  const doc = integrityDocument();
  const slo = doc.slos[0];
  if (slo === undefined) throw new Error('Missing SLO');
  expect(tiersFor(slo)).toEqual([]);
  expect(sloAlerts(slo).policies).toEqual([]);
  expect(generateGrafanaSlos([doc]).slos).toEqual([]);
  const rules = generateAlertRules([doc]).groups.flatMap(
    (group) => group.rules
  );
  const rule = rules.find((rule) =>
    rule.name.endsWith(': integrity violation')
  );
  expect(rule?.route).toBe('page');
  expect(rule?.for).toBe('0s');
  expect(rule?.expr).toContain('> 0');
  expect(rule?.expr).not.toContain('and');
  expect(rule?.budget_expr).toBe('');
  for (const candidate of rules) {
    expect(candidate.expr).not.toContain('/ 0)');
    expect(candidate.expr).not.toContain('Infinity');
  }
});
