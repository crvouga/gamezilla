import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLOBAL } from '@libs/infra/public/global';

test('the transferred repository supplies its current OIDC subject and audience', () => {
  // regression: ci-repository-transfer-oidc-subject
  expect(`repo:${GLOBAL.github.owner}/${GLOBAL.github.repo}:pull_request`).toBe(
    'repo:gamezilla-org/gamezilla:pull_request'
  );
  expect(`https://github.com/${GLOBAL.github.owner}`).toBe(
    'https://github.com/gamezilla-org'
  );
});

// regression: ci-immutable-oidc-subject
test('CI trusts the literal immutable subject returned after the repository transfer', () => {
  const github = GLOBAL.github;
  expect(
    `repo:${github.owner}@${github.owner_id}/${github.repo}@${github.repo_id}:pull_request`
  ).toBe('repo:gamezilla-org@336801040/gamezilla@1165464734:pull_request');
  const tofu = join(import.meta.dirname, '../tofu');
  const bootstrap = readFileSync(
    join(tofu, 'stacks/bootstrap/main.tf'),
    'utf8'
  );
  expect(
    bootstrap.match(/github_subject_prefix\s*= local\.github_subject_prefix/g)
  ).toHaveLength(2);
  const infisical = readFileSync(
    join(tofu, 'modules/ci-identity/main.tf'),
    'utf8'
  );
  expect(infisical).toContain('"${var.github_subject_prefix}:*"');
  const aws = readFileSync(
    join(tofu, 'modules/aws-ci-identity/main.tf'),
    'utf8'
  );
  expect(aws).toContain('"${var.github_subject_prefix}:ref:refs/heads/main"');
  expect(aws).toContain('"${var.github_subject_prefix}:ref:refs/heads/*"');
  expect(
    aws.match(/"\$\{var\.github_subject_prefix\}:environment:production"/g)
  ).toHaveLength(2);
});

// regression: ci-bootstrap-trust-update-blocked
test('bootstrap updates the existing CI auth and retires old resources without deletion', () => {
  const tofu = join(import.meta.dirname, '../tofu');
  const infisical = readFileSync(
    join(tofu, 'modules/ci-identity/main.tf'),
    'utf8'
  );
  // Move the existing binding in state so recovery updates it in place.
  expect(infisical).toContain('from = infisical_identity_oidc_auth.ci');
  expect(infisical).toContain('to   = infisical_identity_oidc_auth.github');
  expect(infisical).toContain(
    'resource "infisical_identity_oidc_auth" "github"'
  );
  const imports = readFileSync(
    join(tofu, 'stacks/bootstrap/imports.tf'),
    'utf8'
  );
  for (const address of [
    'module.depot_ci_identity',
    'module.aws_ci.aws_iam_openid_connect_provider.depot',
    'terraform_data.depot_ci_variables',
  ]) {
    expect(imports).toContain(
      `from = ${address}\n  lifecycle {\n    destroy = false`
    );
  }
  // The transferred repo has no existing gamezilla:main rule to import.
  expect(GLOBAL.global_imports?.github_branch_protection).toBeUndefined();
});
