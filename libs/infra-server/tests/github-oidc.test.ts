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

// regression: depot-aws-oidc-unapplied-trust
test('bootstrap adopts the existing Depot issuer before updating CI role trust', () => {
  // CloudTrail event 1df69389-dbb8-4f3f-b848-15c591062f0f: Depot's main
  // token was denied by a role that still trusted only the GitHub issuer.
  const provider = 'arn:aws:iam::169689131173:oidc-provider/identity.depot.dev';
  expect(GLOBAL.global_imports).toHaveProperty(
    'aws_depot_oidc_provider',
    provider
  );
  const imports = read('stacks/bootstrap/imports.tf');
  expect(imports).toContain(
    'for_each = var.global_imports.aws_depot_oidc_provider == null ? toset([]) : toset([var.global_imports.aws_depot_oidc_provider])'
  );
  expect(imports).toMatch(
    /to\s*= module\.aws_ci\.aws_iam_openid_connect_provider\.depot\s+id\s*= each\.value/
  );
  expect(read('stacks/bootstrap/variables.tf')).toMatch(
    /aws_depot_oidc_provider\s*= optional\(string\)/
  );

  const aws = read('modules/aws-ci-identity/main.tf');
  const deploy = aws.slice(
    aws.indexOf('resource "aws_iam_role" "deploy"'),
    aws.indexOf('resource "aws_iam_role_policy" "deploy"')
  );
  expect(deploy).toContain(
    'Principal = { Federated = aws_iam_openid_connect_provider.depot.arn }'
  );
  expect(deploy).toContain('"identity.depot.dev:aud" = "sts.amazonaws.com"');
  expect(deploy).toContain('[for ref in ["refs/heads/main"] :');
  expect(deploy).toContain(
    '"spiffe://identity.depot.dev/org/${var.depot_org_id}/ci/github/${var.github_repository}/ref/${ref}/sandbox/*"'
  );
});
