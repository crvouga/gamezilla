import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type ConftestRunner,
  evaluatePlanPolicy,
  type PlanJson,
} from '@libs/infra/public/plan-policy';
import { assertProperty, fc } from '@pkgs/property';

const PKG = join(import.meta.dirname, '..');
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
  'cloudflare_r2_bucket',
  'github_branch_protection',
  'github_repository',
  'grafana_cloud_stack',
  'infisical_identity',
  'infisical_identity_oidc_auth',
  // Replacing the GitHub OIDC provider would strand every deploy.
  'aws_iam_openid_connect_provider',
  'infisical_project_environment',
  'infisical_project_identity',
  // Replacing a Neki role mints a new password. The branch holds the data.
  'planetscale_neki_branch',
  'planetscale_neki_role',
  'postgresql_extension',
  'random_password',
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
  address: fc.uuid().map((id) => `module.m.r.x["${id}"]`),
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
    managed.some((c) => deletes(c) && !DELETABLE.has(c.type))
  )
    return true;
  if (protection !== 'production') return false;
  return [...new Set(managed.map((c) => c.type))].some((type) => {
    const all = managed.filter((c) => c.type === type);
    const removed = all.filter(deletes).length;
    return removed >= 2 && removed * 2 > all.length;
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
