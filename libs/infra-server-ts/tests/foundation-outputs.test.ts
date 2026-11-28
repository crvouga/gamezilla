import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// regression: live-grafana-diagnostics-report-infrastructure-drift
test('foundation outputs keep deployment settings without persisting changing Grafana diagnostics', () => {
  const source = readFileSync(
    new URL(
      '../../infra-shared-ts/tofu/stacks/foundation/outputs.tf',
      import.meta.url
    ),
    'utf8'
  );
  expect(source).toContain('value = var.worker.name');
  expect(source).toContain('value = var.hosts');
  expect(source).toContain('value = var.protection');
  expect(source).not.toContain('data.http.');
  expect(source).not.toContain('grafana_alert_rule_');
});
