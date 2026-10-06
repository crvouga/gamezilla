import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GLOBAL } from '@libs/infra-shared/global';

const TOFU = join(import.meta.dirname, '../../infra-shared/tofu');
const read = (path: string) => readFileSync(join(TOFU, path), 'utf8');

// regression: github-transfer-immutable-oidc-subject
test('CI trust matches the transferred repository immutable OIDC subject', () => {
  // GET /repos/gamezilla-org/gamezilla/actions/oidc/customization/sub
  // returned this prefix when Check run 36971916169 was denied by Infisical.
  const prefix = 'repo:gamezilla-org@336801040/gamezilla@1165464734';
  const github = GLOBAL.github;
  expect(
    `repo:${github.owner}@${github.owner_id}/${github.repo}@${github.repo_id}`
  ).toBe(prefix);

  const bootstrap = read('stacks/bootstrap/main.tf');
  expect(bootstrap).toContain(
    'github_subject_prefix = "repo:${var.github.owner}@${var.github.owner_id}/${var.github.repo}@${var.github.repo_id}"'
  );
  expect(bootstrap).toMatch(
    /github_subject_prefix\s*= local.github_subject_prefix/
  );
  expect(bootstrap).toMatch(
    /oidc_subject\s*= "\$\{local.github_subject_prefix\}:\*"/
  );
  expect(bootstrap).toMatch(
    /oidc_audience\s*= "https:\/\/github.com\/\$\{var.github.owner\}"/
  );
  const variables = read('stacks/bootstrap/variables.tf');
  expect(variables).toMatch(/owner_id\s*= string/);
  expect(variables).toMatch(/repo_id\s*= string/);

  const infisical = read('modules/ci-identity/main.tf');
  expect(infisical).toContain('from = infisical_identity_oidc_auth.github');
  expect(infisical).toContain('to   = infisical_identity_oidc_auth.ci');
  expect(infisical).toMatch(/bound_subject\s*= var.oidc_subject/);
  expect(infisical).toMatch(/bound_audiences\s*= \[var.oidc_audience\]/);

  const aws = read('modules/aws-ci-identity/main.tf');
  expect(aws).toContain('"${var.github_subject_prefix}:ref:refs/heads/main"');
  expect(aws).toContain('"${var.github_subject_prefix}:ref:refs/heads/*"');
  expect(aws).toContain(
    '"${var.github_subject_prefix}:environment:production"'
  );
  for (const policy of [aws, infisical]) {
    expect(policy).not.toContain('repo:${var.github_repository}');
  }
});

test('AWS roles trust only the GitHub issuer', () => {
  const aws = read('modules/aws-ci-identity/main.tf');
  expect(
    aws.match(
      /Principal = \{ Federated = aws_iam_openid_connect_provider.github.arn \}/g
    )
  ).toHaveLength(2);
  expect(aws.match(/resource "aws_iam_openid_connect_provider"/g)).toHaveLength(
    1
  );
  expect(aws).not.toContain('spiffe://');
});
