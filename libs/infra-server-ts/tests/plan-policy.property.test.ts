import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  ConftestRunner,
  PlanJson,
} from '@libs/infra-shared-ts/plan-policy';
import { evaluatePlanPolicy } from '@libs/infra-shared-ts/plan-policy';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

const PKG = join(import.meta.dirname, '../../infra-shared-ts');
const POLICY = join(PKG, 'policy');

// The conftest pinned in mise.toml, whether or not mise is on PATH. Resolved
// once: `mise exec` per property run costs ~1 s of mise startup each.
const CONFTEST = Bun.spawnSync(['mise', 'which', 'conftest'])
  .stdout.toString()
  .trim();

const conftest: ConftestRunner = ({ args, stdin }) => {
  const r = Bun.spawnSync([CONFTEST, ...args], {
    stdin: Buffer.from(stdin),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    status: r.exitCode,
    stdout: r.stdout.toString(),
    stderr: r.stderr.toString(),
  };
};

/** The allow-list, read from the policy itself. */
const DELETABLE: ReadonlySet<string> = new Set(
  [
    ...(
      readFileSync(join(POLICY, 'stateful.rego'), 'utf8').match(
        /deletable := \{([^}]*)\}/
      )?.[1] ?? ''
    ).matchAll(/"([a-z0-9_]+)"/g),
  ].map((m) => m[1] ?? '')
);

/**
 * Resource types the modules declare that hold data (or can't be recreated
 * losslessly). Every managed type in tofu/modules must be in exactly one of
 * DELETABLE or PROTECTED, so adding a resource forces a decision.
 */
const PROTECTED: ReadonlySet<string> = new Set([
  'railway_project',
  'railway_environment',
  'cloudflare_r2_bucket',
  'github_branch_default',
  'github_repository_ruleset',
  'github_repository_environment',
  // Deleting it would let any branch deploy to production.
  'github_repository_environment_deployment_policy',
  'github_actions_repository_permissions',
  'github_workflow_repository_permissions',
  'github_repository_vulnerability_alerts',
  'github_repository_dependabot_security_updates',
  'github_repository',
  'grafana_cloud_stack',
  // These Grafana resources hold views that cannot be reconstructed from telemetry.
  'grafana_folder',
  'grafana_dashboard',
  'grafana_rule_group',
  'grafana_folder',
  'grafana_dashboard',
  'grafana_rule_group',
  // The IRM integration's address is in every alert sent so far; the
  // Synthetic Monitoring installation is the stack's tenant.
  'grafana_oncall_integration',
  'grafana_synthetic_monitoring_installation',
  'infisical_identity',
  'infisical_identity_oidc_auth',
  // Replacing the GitHub OIDC provider would strand every deploy.
  'aws_iam_openid_connect_provider',
  'infisical_project_environment',
  'infisical_project_identity',
  // Replacing a Postgres role mints a new password. The branch holds the data.
  'planetscale_postgres_branch',
  'planetscale_postgres_branch_role',
  'postgresql_extension',
  'random_password',
]);

/**
 * Resources retired on purpose (policy `retired`): these addresses are
 * excluded from deletion protection and the production mass-delete brake.
 */
const RETIRED: ReadonlySet<string> = new Set([
  'module.report_access.cloudflare_account_token.read',
  'module.report_access.cloudflare_account_token.write',
  'module.population_service.railway_project.worker',
  'module.secrets.random_password.generated_value["POPULATION_CREDENTIAL_SECRET"]',
]);

const ACTIONS = [
  ['no-op'],
  ['create'],
  ['update'],
  ['read'],
  ['forget'],
  ['delete'],
  ['delete', 'create'],
  ['create', 'delete'],
] as const;

type Change = NonNullable<PlanJson['resource_changes']>[number];

const arbChange: fc.Arbitrary<Change> = fc.record({
  address: fc.oneof(
    fc.uuid().map((id) => `module.m.r.x["${id}"]`),
    fc.constantFrom(...RETIRED)
  ),
  mode: fc.constantFrom('managed' as const, 'data' as const),
  type: fc.constantFrom(
    ...DELETABLE,
    ...PROTECTED,
    'neon_project',
    'some_future_type'
  ),
  change: fc
    .constantFrom(...ACTIONS)
    .map((actions) => ({ actions: [...actions] })),
});

const deletes = (c: Change): boolean => c.change.actions.includes('delete');
const drops = (c: Change): boolean =>
  deletes(c) && !c.change.actions.includes('create');

type Teardown = 'production' | 'standard' | null;

/** Independent model of policy/stateful.rego. */
function modelDenies(
  changes: readonly Change[],
  protection: string,
  teardown: Teardown
): boolean {
  if (teardown === 'production') return true;
  const managed = changes.filter((c) => c.mode === 'managed');
  if (
    teardown !== 'standard' &&
    managed.some(
      (c) => deletes(c) && !DELETABLE.has(c.type) && !RETIRED.has(c.address)
    )
  )
    return true;
  if (protection !== 'production') return false;
  return [...new Set(managed.map((c) => c.type))].some((type) => {
    const counted = managed.filter(
      (c) => c.type === type && !RETIRED.has(c.address)
    );
    const removed = counted.filter(drops).length;
    return removed >= 2 && removed * 2 > counted.length;
  });
}

describe('policy/stateful.rego', () => {
  test('denies exactly what the model denies', () => {
    assertProperty(
      'plan policy matches model',
      fc.property(
        fc.array(arbChange, { maxLength: 8 }),
        fc.constantFrom('production', 'standard'),
        fc.constantFrom<Teardown>(null, 'standard', 'production'),
        (changes, protection, teardown) => {
          const verdict = evaluatePlanPolicy(
            {
              resource_changes: changes,
              variables: { protection: { value: protection } },
              ...(teardown === null
                ? {}
                : { teardown: { protection: teardown } }),
            },
            POLICY,
            conftest
          );
          expect(!verdict.allowed).toBe(
            modelDenies(changes, protection, teardown)
          );
        }
      )
    );
  }, 120_000);

  test('never allows deleting or replacing a protected type outside a standard teardown', () => {
    assertProperty(
      'protected types are never deleted',
      fc.property(
        fc.constantFrom(...PROTECTED, 'neon_project', 'some_future_type'),
        fc.constantFrom(['delete'], ['delete', 'create'], ['create', 'delete']),
        fc.constantFrom('production', 'standard'),
        (type, actions, protection) => {
          const verdict = evaluatePlanPolicy(
            {
              resource_changes: [
                {
                  address: `x.${type}.y`,
                  mode: 'managed',
                  type,
                  change: { actions },
                },
              ],
              variables: { protection: { value: protection } },
            },
            POLICY,
            conftest
          );
          expect(verdict.allowed).toBe(false);
        }
      )
    );
  }, 120_000);

  test('the retired Neki databases may be deleted together in production', () => {
    const addresses = [
      'module.database.planetscale_neki_branch.production[0]',
      'module.database.planetscale_neki_branch.standard[0]',
      'module.database.planetscale_neki_role.migrate',
      'module.database.planetscale_neki_role.app',
      'module.database.planetscale_neki_role.obs_read',
    ];
    const verdict = evaluatePlanPolicy(
      {
        resource_changes: addresses.map((address) => ({
          address,
          mode: 'managed' as const,
          type: address.includes('_role.')
            ? 'planetscale_neki_role'
            : 'planetscale_neki_branch',
          change: { actions: ['delete'] },
        })),
        variables: { protection: { value: 'production' } },
      },
      POLICY,
      conftest
    );
    expect(verdict.allowed).toBe(true);
  });

  test('only the old disposable population projects may be deleted during consolidation', () => {
    for (const address of [
      'module.population_service.railway_project.worker',
      'railway_project.this',
    ]) {
      const verdict = evaluatePlanPolicy(
        {
          resource_changes: [
            {
              address,
              mode: 'managed',
              type: 'railway_project',
              change: { actions: ['delete'] },
            },
          ],
          variables: { protection: { value: 'production' } },
        },
        POLICY,
        conftest
      );
      expect(verdict.allowed).toBe(
        address === 'module.population_service.railway_project.worker'
      );
    }
  });

  test('only the retired generated secret may be deleted; every other one is kept', () => {
    const verdictFor = (name: string, protection: string) =>
      evaluatePlanPolicy(
        {
          resource_changes: [
            {
              address: `module.secrets.random_password.generated_value["${name}"]`,
              mode: 'managed',
              type: 'random_password',
              change: { actions: ['delete'] },
            },
          ],
          variables: { protection: { value: protection } },
        },
        POLICY,
        conftest
      );
    for (const protection of ['production', 'standard']) {
      expect(
        verdictFor('POPULATION_CREDENTIAL_SECRET', protection).allowed
      ).toBe(true);
      for (const name of [
        'AUTH_SECRET',
        'POPULATION_WORKER_TOKEN',
        'EMQX_JWT_SECRET',
      ])
        expect(verdictFor(name, protection).allowed).toBe(false);
    }
  });

  test('every managed resource type in tofu/ is classified', () => {
    const declared = new Set<string>();
    for (const file of new Bun.Glob('tofu/**/*.tf').scanSync(PKG)) {
      const hcl = readFileSync(join(PKG, file), 'utf8');
      for (const m of hcl.matchAll(/^resource "([a-z0-9_]+)"/gm))
        declared.add(m[1] ?? '');
    }
    const unclassified = [...declared].filter(
      (t) => !DELETABLE.has(t) && !PROTECTED.has(t)
    );
    const both = [...declared].filter(
      (t) => DELETABLE.has(t) && PROTECTED.has(t)
    );
    expect({ unclassified, both }).toEqual({ unclassified: [], both: [] });
  });
});
