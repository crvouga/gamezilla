import { expect, test } from 'bun:test';
import { generateAlertRules } from '@libs/observability-server-ts/slo-alert-rules';
import { generateGrafanaSlos } from '@libs/observability-server-ts/slo-grafana';
import { objectiveFiles } from './specs';

// regression: grafana-alert-rule-quota-exhaustion
test('both environments fit Grafana alert-rule capacity with every objective installed', () => {
  const docs = objectiveFiles().map((file) => file.doc);
  const rules = generateAlertRules(docs).groups.flatMap((group) => group.rules);
  // The hosted inventory reports 13 recording rules for each Grafana SLO.
  const recordingRules = generateGrafanaSlos(docs).slos.length * 13;
  const development = rules.filter((rule) => !rule.production_only).length;
  const production = rules.length;
  expect(development + production + recordingRules * 2).toBeLessThanOrEqual(
    1000
  );
});
