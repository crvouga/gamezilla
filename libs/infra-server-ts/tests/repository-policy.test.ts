import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { cpSync, mkdtempSync, readdirSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GLOBAL } from '@libs/infra-shared-ts/global';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const TOFU = join(import.meta.dirname, '../../infra-shared-ts/tofu');
const repository = readFileSync(
  join(TOFU, 'modules/repository/main.tf'),
  'utf8'
);
const actions = readFileSync(
  join(TOFU, 'modules/repository/actions.tf'),
  'utf8'
);
const imports = readFileSync(join(TOFU, 'stacks/bootstrap/imports.tf'), 'utf8');

// regression: repository-ruleset-solo-approval
test('main requires verified PRs without approvals a solo maintainer cannot give and refuses deletion and force-pushes', () => {
  expect(repository).toMatch(/resource "github_repository_ruleset" "main"/);
  for (const rule of ['deletion', 'non_fast_forward']) {
    expect(repository).toMatch(new RegExp(`${rule}\\s*=\\s*true`));
  }
  expect(repository).toMatch(/include\s*=\s*\["refs\/heads\/main"\]/);
  expect(repository).toMatch(/enforcement\s*=\s*"active"/);
  expect(repository).toMatch(/\bpull_request\s*\{/);
  expect(repository).toMatch(/required_approving_review_count\s*=\s*0/);
  expect(repository).toMatch(/require_last_push_approval\s*=\s*false/);
  expect(repository).toMatch(/dismiss_stale_reviews_on_push\s*=\s*true/);
  expect(repository).toMatch(/required_review_thread_resolution\s*=\s*true/);
  expect(repository).toMatch(/\brequired_status_checks\s*\{/);
  expect(repository).toMatch(/strict_required_status_checks_policy\s*=\s*true/);
  expect(repository).toContain(
    'for_each = { for check in local.required_checks'
  );
  expect(repository).toContain(
    'integration_id = required_check.value.integration_id'
  );
  const directory = join(TOFU, 'modules/repository/required-checks');
  const checks = readdirSync(directory).map(
    (file) =>
      JSON.parse(readFileSync(join(directory, file), 'utf8')) as {
        readonly context: string;
        readonly integration_id: number;
      }
  );
  expect(checks).toEqual(
    expect.arrayContaining([
      { context: 'verify:start', integration_id: 15368 },
      { context: 'verify:end', integration_id: 15368 },
      { context: 'GitGuardian Security Checks', integration_id: 46505 },
    ])
  );
  expect(new Set(checks.map((check) => check.context)).size).toBe(
    checks.length
  );
  expect(repository).not.toMatch(/\bbypass_actors\s*\{/);
  expect(repository).not.toMatch(/resource "github_branch_protection"/);
});

test('merge-commit-only history and disposable heads remain compatible with main protection', () => {
  expect(repository).toMatch(/allow_merge_commit\s*=\s*true/);
  expect(repository).toMatch(/allow_squash_merge\s*=\s*false/);
  expect(repository).toMatch(/allow_rebase_merge\s*=\s*false/);
  expect(repository).not.toMatch(/required_linear_history/);
  expect(repository).toMatch(/delete_branch_on_merge\s*=\s*true/);
  expect(repository).toMatch(/branch\s*=\s*"main"/);
});

// regression: repository-policy-refuses-auto-merge
test('the declared merge settings pass the bootstrap repository policy', () => {
  // Literal failing input: main.tf set allow_auto_merge = true while
  // git-hygiene.rego still required false, so Release's apply was refused.
  const setting = (name: string): boolean => {
    const value = repository.match(
      new RegExp(`\\b${name}\\s*=\\s*(true|false)`)
    )?.[1];
    expect(value, name).toBeDefined();
    return value === 'true';
  };
  const after = Object.fromEntries(
    [
      'allow_auto_merge',
      'delete_branch_on_merge',
      'allow_merge_commit',
      'allow_squash_merge',
      'allow_rebase_merge',
    ].map((name) => [name, setting(name)])
  );
  expect(after['allow_auto_merge']).toBe(true);
  const conftest = Bun.spawnSync(['mise', 'which', 'conftest'])
    .stdout.toString()
    .trim();
  const verdict = (settings: Record<string, boolean>) =>
    spawnSync(
      conftest,
      ['test', '--policy', join(TOFU, '../policy'), '--namespace', 'main', '-'],
      {
        input: JSON.stringify({
          resource_changes: [
            {
              address: 'module.repository.github_repository.this',
              mode: 'managed',
              type: 'github_repository',
              change: { actions: ['update'], after: settings },
            },
          ],
        }),
        encoding: 'utf8',
      }
    );
  const declared = verdict(after);
  expect(declared.status, declared.stdout).toBe(0);
  expect(verdict({ ...after, allow_squash_merge: true }).status).not.toBe(0);
});

test('only descriptive metadata may drift without a plan', () => {
  expect(repository).toMatch(/ignore_changes\s*=\s*\[description, topics\]/);
  for (const name of Object.keys(GLOBAL.github.settings)) {
    if (name === 'allow_forking') continue;
    expect(repository).toMatch(
      new RegExp(`${name}\\s*=\\s*var.settings.${name}`)
    );
  }
  expect(repository).toMatch(/prevent_destroy\s*=\s*true/);
  expect(GLOBAL.global_imports?.github_repository).toBe(GLOBAL.github.repo);
});

// regression: bootstrap-user-owned-forking
test('a user-owned repository does not send allow_forking', () => {
  // Literal failing input: plan `allow_forking = true -> false` on the
  // source repository, then PATCH /repos/<owner>/<repo> 422
  // "Allow forks setting can only be changed on org-owned private repositories".
  expect(GLOBAL.github.owner).toBe('crvouga');
  expect(GLOBAL.github.owner_is_organization).toBe(false);
  expect(GLOBAL.github.settings.allow_forking).toBe(false);
  expect(repository).toMatch(
    /allow_forking\s*=\s*var\.owner_is_organization \? var\.settings\.allow_forking : null/
  );
  const bootstrap = readFileSync(
    join(TOFU, 'stacks/bootstrap/main.tf'),
    'utf8'
  );
  expect(bootstrap).toMatch(
    /owner_is_organization\s*=\s*var\.github\.owner_is_organization/
  );
});

// regression: github-security-unsupported-fields
test('security configuration excludes fields the pinned provider cannot read or write', () => {
  // Literal failing inputs: code_security { status = "disabled" } and
  // secret_scanning_non_provider_patterns { status = "disabled" } both
  // planned additions forever despite the API already reporting disabled.
  expect(repository).not.toMatch(/\bcode_security\s*\{/);
  expect(repository).not.toMatch(
    /\bsecret_scanning_non_provider_patterns\s*\{/
  );
  expect(repository).toMatch(/\bsecret_scanning\s*\{/);
  expect(repository).toMatch(/\bsecret_scanning_push_protection\s*\{/);
});

// regression: public-repository-self-hosted-runner
test('only main may deploy to production, and a branch Health run stays outside it', () => {
  const bootstrap = readFileSync(
    join(TOFU, 'stacks/bootstrap/main.tf'),
    'utf8'
  );
  expect(bootstrap).toMatch(/main_only_environments\s*=\s*\["production"\]/);
  expect(actions).toMatch(/custom_branch_policies\s*=\s*true/);
  expect(actions).toMatch(
    /resource "github_repository_environment_deployment_policy" "main" \{[^}]*branch_pattern\s*=\s*"main"/
  );
  expect(imports).toContain(
    'module.repository.github_repository_environment_deployment_policy.main["production"]'
  );
  const health = readFileSync(
    join(import.meta.dirname, '../../../.github/workflows/health.yml'),
    'utf8'
  );
  for (const line of health.match(/^\s*environment: .*$/gm) ?? [])
    if (line.includes("'production'"))
      expect(line).toContain("github.ref == 'refs/heads/main'");
});

test('a public repository exposes no wiki or classic projects', () => {
  expect(GLOBAL.github.settings.has_wiki).toBe(false);
  expect(GLOBAL.github.settings.has_projects).toBe(false);
  expect(GLOBAL.github.settings.has_discussions).toBe(false);
});

// regression: public-repository-self-hosted-runner
// regression: declared-visibility-publishes-repository
test('the repository is public only by its own declared edit, and is then scanned for secrets', () => {
  // Publishing is a deliberate change to `visibility`, never a side effect:
  // an apply must not make a private repository public.
  expect(['private', 'public']).toContain(GLOBAL.github.settings.visibility);
  for (const setting of ['secret_scanning', 'secret_scanning_push_protection'])
    expect(repository).toMatch(
      new RegExp(
        `\\b${setting}\\s*\\{\\s*status\\s*=\\s*var\\.settings\\.visibility == "public" \\? "enabled" : "disabled"`
      )
    );
  expect(actions).toMatch(/sha_pinning_required\s*=\s*true/);
  for (const resource of [
    'github_repository_vulnerability_alerts',
    'github_repository_dependabot_security_updates',
  ])
    expect(actions).toMatch(
      new RegExp(`resource "${resource}" "this" \\{[^}]*enabled\\s*=\\s*true`)
    );
});

test('Actions has read defaults, cannot approve PRs, and existing configuration is adopted', () => {
  expect(actions).toMatch(/default_workflow_permissions\s*=\s*"read"/);
  expect(actions).toMatch(/can_approve_pull_request_reviews\s*=\s*false/);
  expect(actions).not.toMatch(
    /resource "github_actions_(?:environment_)?secret"/
  );
  for (const address of [
    'github_branch_default.main',
    'github_actions_repository_permissions.this',
    'github_workflow_repository_permissions.this',
    'github_repository_vulnerability_alerts.this',
    'github_repository_dependabot_security_updates.this',
    'github_repository_environment.this[each.value]',
  ]) {
    expect(imports).toContain(`module.repository.${address}`);
  }
  expect(new Set(GLOBAL.global_imports?.github_variables)).toEqual(
    new Set([
      'AWS_HEALTH_ROLE_ARN',
      'AWS_ROLE_ARN',
      'SECRETS_IDENTITY_ID',
      'SECRETS_PROJECT_ID',
    ])
  );
});

type PolicyJob = {
  needs?: string | string[];
  if?: string;
  environment?: string;
  concurrency?: { group: string };
  steps?: { run?: string }[];
};

function workflow(name: string): Record<string, PolicyJob> {
  return (
    Bun.YAML.parse(
      readFileSync(join(TOFU, '../../../.github/workflows', name), 'utf8')
    ) as { jobs: Record<string, PolicyJob> }
  ).jobs;
}

test('CI applies repository policy before deployment and checks drift without applying', () => {
  const release = workflow('deploy.yml');
  const apply = release['deploy-repository-policy'];
  const drift = workflow('health.yml')['health-repository-policy'];
  expect(apply?.needs).toBe('deploy-verify');
  expect(release['deploy-fleet']?.needs).toContain('deploy-repository-policy');
  for (const job of [apply, drift]) {
    expect(job?.environment).toBe('production');
    expect(job?.if).toContain("github.ref == 'refs/heads/main'");
    expect(job?.concurrency?.group).toBe('repository-policy');
  }
  expect(
    apply?.steps?.some((step) => step.run?.includes('#apply:repository-policy'))
  ).toBe(true);
  expect(
    drift?.steps?.some((step) => step.run?.includes('#drift:repository-policy'))
  ).toBe(true);
  expect(drift?.steps?.some((step) => step.run?.includes('#apply:'))).toBe(
    false
  );
});

// regression: required-checks-path-shadowing
test('the real required-check registry expression evaluates under OpenTofu', () => {
  const fixture = mkdtempSync(join(tmpdir(), 'required-checks-expression-'));
  try {
    cpSync(
      join(TOFU, 'modules/repository/required-checks'),
      join(fixture, 'required-checks'),
      { recursive: true }
    );
    const expression = repository.match(/required_checks\s*=\s*(.+)/)?.[1];
    expect(expression).toBeDefined();
    const result = spawnSync(
      'tofu',
      [`-chdir=${fixture}`, 'console', '-no-color'],
      {
        cwd: join(TOFU, '../../..'),
        input: `jsonencode(${expression})\n`,
        encoding: 'utf8',
      }
    );
    expect(result.status, result.stderr).toBe(0);
    const expected = readdirSync(join(fixture, 'required-checks'))
      .sort()
      .map((file) =>
        JSON.parse(readFileSync(join(fixture, 'required-checks', file), 'utf8'))
      );
    expect(JSON.parse(JSON.parse(result.stdout) as string)).toEqual(expected);
  } finally {
    removeTree(fixture, { whenLocked: 'leave' });
  }
});

// regression: tofu-plan-abandoned-lock
test('abandoned-lock recovery shares the policy lock and requires an explicit rehearsal input', () => {
  const preview = workflow('deploy.yml')['deploy-rehearsal'];
  expect(preview?.if).toContain('inputs.rehearsal');
  expect(preview?.concurrency?.group).toBe('repository-policy');
  const text = readFileSync(
    join(TOFU, '../../../.github/workflows/deploy.yml'),
    'utf8'
  );
  expect(text).toContain("if: ${{ inputs.abandoned-bootstrap-lock != '' }}");
  expect(text).toContain(
    'TOFU_ABANDONED_LOCK_ID: ${{ inputs.abandoned-bootstrap-lock }}'
  );
  expect(
    preview?.steps?.some((step) =>
      step.run?.includes('#unlock:repository-policy')
    )
  ).toBe(true);
});
