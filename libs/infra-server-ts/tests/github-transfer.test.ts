import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLOBAL } from '@libs/infra-shared-ts/global';
import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';

const [OWNER, REPO] = PRODUCT.external.sourceRepository.split('/');

test('the transferred repository supplies its current OIDC subject and audience', () => {
  // regression: ci-repository-transfer-oidc-subject
  expect(`repo:${GLOBAL.github.owner}/${GLOBAL.github.repo}:pull_request`).toBe(
    `repo:${PRODUCT.external.sourceRepository}:pull_request`
  );
  expect(`https://github.com/${GLOBAL.github.owner}`).toBe(
    `https://github.com/${OWNER}`
  );
});

// regression: ci-immutable-oidc-subject
// regression: ci-identity-regression-stale-interface
test('CI trusts the literal immutable subject returned after the repository transfer', () => {
  const github = GLOBAL.github;
  expect(
    `repo:${github.owner}@${github.owner_id}/${github.repo}@${github.repo_id}:pull_request`
  ).toBe(`repo:${OWNER}@49178412/${REPO}@1165464734:pull_request`);
  const tofu = join(import.meta.dirname, '../../infra-shared-ts/tofu');
  const bootstrap = readFileSync(
    join(tofu, 'stacks/bootstrap/main.tf'),
    'utf8'
  );
  expect(bootstrap).toMatch(
    /github_subject_prefix\s*= local\.github_subject_prefix/
  );
  expect(bootstrap).toMatch(
    /oidc_subject\s*= "\$\{local\.github_subject_prefix\}:\*"/
  );
  const infisical = readFileSync(
    join(tofu, 'modules/ci-identity/main.tf'),
    'utf8'
  );
  expect(infisical).toMatch(/bound_subject\s*= var\.oidc_subject/);
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
test('bootstrap updates the existing CI auth without recreating its binding', () => {
  const tofu = join(import.meta.dirname, '../../infra-shared-ts/tofu');
  const infisical = readFileSync(
    join(tofu, 'modules/ci-identity/main.tf'),
    'utf8'
  );
  // Move the existing binding in state so recovery updates it in place.
  expect(infisical).toContain('from = infisical_identity_oidc_auth.github');
  expect(infisical).toContain('to   = infisical_identity_oidc_auth.ci');
  expect(infisical).toContain('resource "infisical_identity_oidc_auth" "ci"');
  // The transferred repo has no existing `<repo>:main` rule to import.
  expect(GLOBAL.global_imports).not.toHaveProperty('github_branch_protection');
});
