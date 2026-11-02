import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLOBAL } from '@libs/infra-shared-ts/global';

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

test('main requires reviewed verified PRs and refuses deletion and force-pushes', () => {
  expect(repository).toMatch(/resource "github_repository_ruleset" "main"/);
  for (const rule of ['deletion', 'non_fast_forward']) {
    expect(repository).toMatch(new RegExp(`${rule}\\s*=\\s*true`));
  }
  expect(repository).toMatch(/include\s*=\s*\["refs\/heads\/main"\]/);
  expect(repository).toMatch(/enforcement\s*=\s*"active"/);
  expect(repository).toMatch(/\bpull_request\s*\{/);
  expect(repository).toMatch(/required_approving_review_count\s*=\s*1/);
  expect(repository).toMatch(/require_last_push_approval\s*=\s*true/);
  expect(repository).toMatch(/dismiss_stale_reviews_on_push\s*=\s*true/);
  expect(repository).toMatch(/required_review_thread_resolution\s*=\s*true/);
  expect(repository).toMatch(/\brequired_status_checks\s*\{/);
  expect(repository).toMatch(/strict_required_status_checks_policy\s*=\s*true/);
  expect(repository).toMatch(/context\s*=\s*"verify:end"/);
  expect(repository).toMatch(/integration_id\s*=\s*15368/);
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
