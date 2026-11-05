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
    /module "alert_routing"\s*\{\s*#[^\n]*\n\s*depends_on\s*=\s*\[grafana_cloud_stack_service_account_token.alerting\]/
  );
  expect(bootstrap).toMatch(
    /module "synthetic_monitoring"\s*\{\s*#[^\n]*\n\s*depends_on\s*=\s*\[grafana_synthetic_monitoring_installation.this\]/
  );
});

test('both IRM urgency levels have a personal mobile delivery step', () => {
  expect(source).toMatch(
    /resource "grafana_oncall_user_notification_rule" "mobile"\s*\{[^}]*type\s*=\s*"notify_by_mobile_app"/
  );
  expect(source).toMatch(
    /resource "grafana_oncall_user_notification_rule" "important_mobile"\s*\{[^}]*important\s*=\s*true[^}]*type\s*=\s*"notify_by_mobile_app_critical"/
  );
  expect(source).toMatch(
    /resource "grafana_oncall_user_notification_rule" "important_wait"\s*\{[^}]*duration\s*=\s*60/
  );
  expect(source).toMatch(
    /resource "grafana_oncall_user_notification_rule" "important_repeat"\s*\{[^}]*position\s*=\s*2[^}]*type\s*=\s*"notify_by_mobile_app_critical"/
  );
});

test('notification grouping preserves distinct failing capabilities and no digest swallows warnings', () => {
  expect(source).toContain(
    'group_by        = ["environment", "route", "capability", "alertname"]'
  );
  expect(source).toContain('group_wait      = "0s"');
  expect(source).not.toContain('grafana_contact_point.digest');
  expect(source).toContain('value = "page|push"');
});
