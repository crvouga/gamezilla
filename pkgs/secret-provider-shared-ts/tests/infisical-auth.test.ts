import { expect, test } from 'bun:test';
import {
  infisicalProjectArgs,
  infisicalProjectEnv,
  infisicalProjectProfile,
} from '@pkgs/secret-provider-shared-ts/infisical-auth';

const project = {
  workspaceId: '26137c60-8dea-4d95-a8a3-30901615b026',
  domain: 'https://app.infisical.com',
  env: 'dev',
};

// regression: infisical-project-session-isolation
test('a project never selects another project session inherited by its terminal', () => {
  const env = { INFISICAL_PROFILE: 'chris@gogeviti.com--geviti' };
  expect(infisicalProjectArgs(project, env)).toEqual([
    '--projectId',
    project.workspaceId,
    '--env',
    'dev',
    '--domain',
    project.domain,
    '--profile',
    'project-7911acf6-26137c60-8dea-4d95-a8a3-30901615b026',
  ]);
});

// regression: infisical-profile-name-too-long
test('the default project profile name fits the Infisical CLI limit of 64 characters', () => {
  const profile = infisicalProjectProfile(project, {});
  expect(profile.length).toBeLessThanOrEqual(64);
  expect(profile).toMatch(/^project-[0-9a-f]{8}-/);
  expect(profile).toEndWith(project.workspaceId);
  const longest = infisicalProjectProfile(
    {
      domain: `https://${'secrets.'.repeat(30)}example.com`,
      workspaceId: 'w'.repeat(200),
    },
    {}
  );
  expect(longest.length).toBeLessThanOrEqual(64);
  expect(longest).not.toBe(
    infisicalProjectProfile(
      {
        domain: `https://${'secrets.'.repeat(30)}example.com`,
        workspaceId: `${'w'.repeat(199)}x`,
      },
      {}
    )
  );
});

test('worktrees share a project session and may explicitly select their own', () => {
  expect(infisicalProjectProfile(project, {})).toBe(
    infisicalProjectProfile({ ...project, domain: `${project.domain}/api` }, {})
  );
  expect(
    infisicalProjectProfile(project, { SECRETS_PROFILE: 'worktree-a' })
  ).toBe('worktree-a');
  expect(
    infisicalProjectProfile(project, { SECRETS_PROFILE: 'worktree-b' })
  ).toBe('worktree-b');
  expect(
    infisicalProjectProfile({ ...project, workspaceId: 'another-project' }, {})
  ).not.toBe(infisicalProjectProfile(project, {}));
  expect(
    infisicalProjectProfile(
      { ...project, domain: 'https://secrets.gogeviti.com' },
      {}
    )
  ).not.toBe(infisicalProjectProfile(project, {}));
});

test('token-based commands need no locally stored login profile', () => {
  for (const key of [
    'SECRETS_TOKEN',
    'INFISICAL_TOKEN',
    'INFISICAL_ACCESS_TOKEN',
  ])
    expect(infisicalProjectArgs(project, { [key]: 'token' })).not.toContain(
      '--profile'
    );
});

test('project commands discard unrelated terminal pins without changing the parent', () => {
  const parent = {
    INFISICAL_PROFILE: 'geviti',
    INFISICAL_ORG: 'geviti',
    SECRETS_PROFILE: 'worktree-a',
    INFISICAL_TOKEN: 'token',
  };
  const child = infisicalProjectEnv(parent);
  expect(child['INFISICAL_PROFILE']).toBeUndefined();
  expect(child['INFISICAL_ORG']).toBeUndefined();
  expect(child['SECRETS_PROFILE']).toBe('worktree-a');
  expect(child['INFISICAL_TOKEN']).toBe('token');
  expect(parent.INFISICAL_PROFILE).toBe('geviti');
});
