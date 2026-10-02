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
  expect(`${GLOBAL.github.oidc_subject_prefix}:pull_request`).toBe(
    'repo:gamezilla-org@336801040/gamezilla@1165464734:pull_request'
  );
  const tofu = join(import.meta.dirname, '../tofu');
  const bootstrap = readFileSync(
    join(tofu, 'stacks/bootstrap/main.tf'),
    'utf8'
  );
  expect(
    bootstrap.match(
      /github_subject_prefix\s*= var\.github\.oidc_subject_prefix/g
    )
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
