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
