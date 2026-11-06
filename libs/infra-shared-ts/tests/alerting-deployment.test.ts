import { expect, test } from 'bun:test';
import {
  alertingDeploymentDenials,
  alertingDeploymentEnvironment,
  alertingDeploymentPlanArgs,
  validateAlertingDeployment,
} from '@libs/infra-shared-ts/alerting-deployment';
import type { PlanJson } from '@libs/infra-shared-ts/plan-policy';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const paths = { tofuDir: '/tofu', cacheDir: '/cache' };
const mobileRule =
  'module.alert_routing[0].grafana_oncall_user_notification_rule.mobile';

function plan(address: string, actions: readonly string[]): PlanJson {
  return {
    resource_changes: [
      {
        address,
        mode: 'managed',
        type: 'grafana_oncall_user_notification_rule',
        change: { actions },
      },
    ],
  };
}

test('alert deployment uses Grafana, webhook administration and encrypted state', () => {
  const { env, missing } = alertingDeploymentEnvironment(
    {
      GRAFANA_CLOUD_API_TOKEN: 'grafana',
      TOFU_STATE_PASSPHRASE: 'pass',
      TOFU_STATE_ACCESS_KEY_ID: 'state',
      TOFU_STATE_SECRET_ACCESS_KEY: 'secret',
      GITHUB_ADMIN_TOKEN: 'admin',
    },
    paths
  );
  expect(missing).toEqual([]);
  expect(env['GRAFANA_CLOUD_ACCESS_POLICY_TOKEN']).toBe('grafana');
  expect(env['GITHUB_TOKEN']).toBe('admin');
  expect(env['TF_VAR_aws_access_key_id']).toBeUndefined();
  expect(alertingDeploymentEnvironment({}, paths).missing).toHaveLength(5);
  expect(alertingDeploymentPlanArgs(paths)).toContain(
    '-target=module.alert_routing'
  );
  expect(alertingDeploymentPlanArgs(paths)).toContain(
    '-target=module.synthetic_monitoring'
  );
  expect(alertingDeploymentPlanArgs(paths)).toContain(
    '-target=github_repository_webhook.ci_alerts'
  );
  expect(
    alertingDeploymentDenials(
      plan('github_repository_webhook.ci_alerts[0]', ['create'])
    )
  ).toEqual([]);
});

test('alerting cannot change unrelated dependencies or destroy notification configuration', () => {
  for (const address of [
    'module.trace_stack.grafana_cloud_stack.this',
    'module.alert_routing_other.grafana_contact_point.this',
    'grafana_cloud_stack_service_account.alerting_other',
    'module.repository.github_repository.this',
  ]) {
    expect(alertingDeploymentDenials(plan(address, ['update']))).toHaveLength(
      1
    );
    expect(alertingDeploymentDenials(plan(address, ['no-op']))).toEqual([]);
  }
  for (const actions of [['create'], ['update'], ['no-op']])
    expect(alertingDeploymentDenials(plan(mobileRule, actions))).toEqual([]);
  for (const command of ['apply', 'plan', 'drift'])
    expect(() =>
      validateAlertingDeployment(command, 'bootstrap')
    ).not.toThrow();
  expect(() => validateAlertingDeployment('destroy', 'bootstrap')).toThrow();
  expect(() => validateAlertingDeployment('apply', 'foundation')).toThrow();
});

test('every destructive action is rejected even when accompanied by an allowed action', () => {
  assertProperty(
    'alert delivery cannot destroy infrastructure',
    fc.property(
      fc.oneof(fc.constant(mobileRule), fc.string()),
      fc.array(fc.constantFrom('create', 'update', 'no-op'), { maxLength: 4 }),
      fc.constantFrom('delete', 'forget'),
      (address, other, destructive) => {
        expect(
          alertingDeploymentDenials(plan(address, [destructive, ...other]))
        ).toHaveLength(1);
        expect(
          alertingDeploymentDenials(plan(address, [...other, destructive]))
        ).toHaveLength(1);
      }
    )
  );
});

// regression: alerting-service-account-forbidden
test('alerting management credentials are planned and permitted without widening the deployment scope', () => {
  for (const address of [
    'grafana_cloud_access_policy.alerting_management',
    'grafana_cloud_access_policy_token.alerting_management',
  ]) {
    expect(alertingDeploymentPlanArgs(paths)).toContain(`-target=${address}`);
    expect(alertingDeploymentDenials(plan(address, ['create']))).toEqual([]);
    expect(alertingDeploymentDenials(plan(address, ['delete']))).toHaveLength(
      1
    );
    expect(
      alertingDeploymentDenials(plan(`${address}_other`, ['create']))
    ).toHaveLength(1);
  }
});
