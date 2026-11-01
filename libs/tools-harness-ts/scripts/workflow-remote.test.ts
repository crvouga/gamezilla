import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { WORKFLOW_DISPATCH } from './workflow-remote';

const WORKFLOWS = join(import.meta.dirname, '../../../.github/workflows');

describe('WORKFLOW_DISPATCH', () => {
  test('health follows the checkout; deploy ships main', () => {
    expect(WORKFLOW_DISPATCH.health).toEqual({
      workflow: 'health.yml',
      sync: 'branch',
      inputs: {},
    });
    expect(WORKFLOW_DISPATCH.deploy).toEqual({
      workflow: 'deploy.yml',
      sync: 'trunk',
      inputs: {},
    });
  });

  test('workflow jobs call the local runners', () => {
    const health = readFileSync(join(WORKFLOWS, 'health.yml'), 'utf8');
    const deploy = readFileSync(join(WORKFLOWS, 'deploy.yml'), 'utf8');
    expect(health).toContain('run: bun run health:local');
    expect(health).not.toContain('run: bun run health\n');
    expect(deploy).toContain('run: bun run deploy:local');
    expect(deploy).not.toContain('run: bun run deploy\n');
    expect(deploy).toContain('require-main: ${{ !inputs.rehearsal }}');
  });

  // regression: release-pending-merges-replaced
  test('Release runs on every merge to main and ships only what the whole gate verified', () => {
    const deploy = Bun.YAML.parse(
      readFileSync(join(WORKFLOWS, 'deploy.yml'), 'utf8')
    ) as {
      on: Record<string, unknown>;
      concurrency: Record<string, unknown>;
      jobs: Record<
        string,
        {
          uses?: string;
          with?: Record<string, string>;
          needs?: string | string[];
          if?: string;
        }
      >;
    };
    expect(Object.keys(deploy.on)).toEqual(['push', 'workflow_dispatch']);
    expect(deploy.on['push']).toEqual({ branches: ['main'] });
    expect(deploy.concurrency).toEqual({
      group: 'deploy-main',
      queue: 'max',
      'cancel-in-progress': false,
    });
    // A pull request runs the fast profile; the release runs every gate task.
    expect(deploy.jobs['deploy-verify']).toMatchObject({
      uses: './.github/workflows/verify-pr.yml',
    });
    expect(deploy.jobs['deploy-verify']).toHaveProperty(
      'with.profile',
      'release'
    );
    expect(deploy.jobs['deploy-verify']).toHaveProperty(
      'with.require-main',
      '${{ !inputs.rehearsal }}'
    );
    // A pull request enforced the advisories; Release reports what moved since.
    expect(deploy.jobs['deploy-verify']).toHaveProperty(
      'with.advisories',
      'report'
    );
    // Verification, repository policy, fleet, dev, production, then release.
    expect(deploy.jobs['deploy-repository-policy']!.needs).toBe(
      'deploy-verify'
    );
    expect(deploy.jobs['deploy-fleet']!.needs).toEqual([
      'deploy-verify',
      'deploy-repository-policy',
    ]);
    expect(deploy.jobs['deploy-dev']!.needs).toBe('deploy-fleet');
    expect(deploy.jobs['deploy-prd']!.needs).toBe('deploy-dev');
    expect(deploy.jobs['deploy-release']!.needs).toBe('deploy-prd');
  });
});
