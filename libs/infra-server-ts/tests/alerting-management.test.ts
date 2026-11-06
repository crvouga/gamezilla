import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

// regression: alerting-service-account-forbidden
test('alerting service accounts use a stack-scoped management credential', () => {
  const source = readFileSync(
    new URL(
      '../../infra-shared-ts/tofu/stacks/bootstrap/alerting.tf',
      import.meta.url
    ),
    'utf8'
  );
  expect(source).toContain(
    'scopes = ["stacks:read", "stack-service-accounts:write"]'
  );
  for (const kind of [
    'grafana_cloud_stack_service_account',
    'grafana_cloud_stack_service_account_token',
  ]) {
    const block = source
      .split(`resource "${kind}" "alerting" {`)[1]
      ?.split('\n}')[0];
    expect(block).toMatch(/provider\s*= grafana.alerting_management/);
  }
  expect(source).toContain(
    'cloud_access_policy_token = grafana_cloud_access_policy_token.alerting_management.token'
  );
});

// regression: alerting-irm-editor-forbidden
test('the alert provisioner can create IRM integrations and manage responder notification rules', () => {
  const source = readFileSync(
    new URL(
      '../../infra-shared-ts/tofu/stacks/bootstrap/alerting-provisioner.tf',
      import.meta.url
    ),
    'utf8'
  );
  const account = source
    .split(
      'resource "grafana_cloud_stack_service_account" "alerting_provisioner" {'
    )[1]
    ?.split('\n}')[0];
  // Editor received HTTP 403 creating integrations, escalation chains and
  // another user's personal notification rules in Release 42181063224.
  expect(account).toMatch(/role\s*=\s*"Admin"/);
});

// regression: alerting-role-replacement
test('provisioning preserves the delivery-check account and uses a separate administrator', () => {
  const source = readFileSync(
    new URL(
      '../../infra-shared-ts/tofu/stacks/bootstrap/alerting.tf',
      import.meta.url
    ),
    'utf8'
  );
  const account = source
    .split('resource "grafana_cloud_stack_service_account" "alerting" {')[1]
    ?.split('\n}')[0];
  expect(account).toMatch(/role\s*=\s*"Editor"/);
  expect(source).toContain(
    'grafana_cloud_stack_service_account_token.alerting_provisioner[0].key'
  );
  const evidence = readFileSync(
    new URL(
      '../../infra-shared-ts/tofu/stacks/bootstrap/alerting-evidence.tf',
      import.meta.url
    ),
    'utf8'
  );
  expect(evidence).toContain(
    'grafana_cloud_stack_service_account_token.alerting[0].key'
  );
});
