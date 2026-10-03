import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLOBAL } from '@libs/infra/public/global';

const TOFU = join(import.meta.dirname, '../tofu');
const repository = readFileSync(
  join(TOFU, 'modules/repository/main.tf'),
  'utf8'
);
const actions = readFileSync(
  join(TOFU, 'modules/repository/actions.tf'),
  'utf8'
);
const imports = readFileSync(join(TOFU, 'stacks/bootstrap/imports.tf'), 'utf8');

test('main policy requires verified current-main CI with no bypass or approval ceremony', () => {
  // Decided policy: the live Check / check runs originate from Depot Code Access.
  expect(GLOBAL.github.check_integration_id).toBe(219785);
  expect(repository).toMatch(/resource "github_repository_ruleset" "main"/);
  for (const rule of [
    'deletion',
    'non_fast_forward',
    'required_linear_history',
    'required_review_thread_resolution',
    'strict_required_status_checks_policy',
  ]) {
    expect(repository).toMatch(new RegExp(`${rule}\\s*=\\s*true`));
  }
  expect(repository).toMatch(/include\s*=\s*\["refs\/heads\/main"\]/);
  expect(repository).toMatch(/enforcement\s*=\s*"active"/);
  expect(repository).toMatch(/required_approving_review_count\s*=\s*0/);
  expect(repository).toMatch(/integration_id\s*=\s*var.check_integration_id/);
  expect(repository).not.toMatch(/\bbypass_actors\s*\{/);
  expect(repository).not.toMatch(/resource "github_branch_protection"/);
});

test('squash-only history and disposable heads remain compatible with main protection', () => {
  expect(repository).toMatch(/allow_squash_merge\s*=\s*true/);
  expect(repository).toMatch(/allow_merge_commit\s*=\s*false/);
  expect(repository).toMatch(/allow_rebase_merge\s*=\s*false/);
  expect(repository).toMatch(/allowed_merge_methods\s*=\s*\["squash"\]/);
  expect(repository).toMatch(/delete_branch_on_merge\s*=\s*true/);
  expect(repository).toMatch(/branch\s*=\s*"main"/);
});

test('only descriptive metadata may drift without a plan', () => {
  expect(repository).toMatch(/ignore_changes\s*=\s*\[description, topics\]/);
  for (const name of Object.keys(GLOBAL.github.settings)) {
    expect(repository).toMatch(
      new RegExp(`${name}\\s*=\\s*var.settings.${name}`)
    );
  }
  expect(repository).toMatch(/prevent_destroy\s*=\s*true/);
  expect(GLOBAL.global_imports?.github_repository).toBe(GLOBAL.github.repo);
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
