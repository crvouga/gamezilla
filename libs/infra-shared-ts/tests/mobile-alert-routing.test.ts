// @io-wall-ok — reads the declarative notification resources.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(import.meta.dir, '../tofu/modules/alert-routing/main.tf'),
  'utf8'
);

// regression: alerting-first-apply-provider-credentials
test('initial alerting reads wait for the provider credentials to exist', () => {
  const bootstrap = readFileSync(
    join(import.meta.dir, '../tofu/stacks/bootstrap/alerting.tf'),
    'utf8'
  );
  expect(bootstrap).toMatch(
    /module "alert_routing"\s*\{\s*#[^\n]*\n\s*depends_on\s*=\s*\[grafana_cloud_stack_service_account_token.alerting_provisioner\]/
  );
  expect(bootstrap).toMatch(
    /module "synthetic_monitoring"\s*\{\s*#[^\n]*\n\s*depends_on\s*=\s*\[grafana_synthetic_monitoring_installation.this\]/
  );
});

test('Grafana keeps a silent inbox without routes, escalations or personal delivery rules', () => {
  expect(source).toContain('default_route {}');
  for (const kind of [
    'grafana_oncall_route',
    'grafana_oncall_escalation',
    'grafana_oncall_escalation_chain',
    'grafana_oncall_user_notification_rule',
  ])
    expect(source).not.toContain(`resource "${kind}"`);
});

test('notification grouping preserves distinct failing capabilities and no digest swallows warnings', () => {
  expect(source).toContain(
    'group_by        = ["environment", "route", "capability", "alertname"]'
  );
  expect(source).toContain('group_wait      = "0s"');
  expect(source).not.toContain('grafana_contact_point.digest');
  expect(source).toContain('value = "page|push"');
});
