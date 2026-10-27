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

  test('Deploy runs on a schedule and ships only what the whole gate verified', () => {
    const deploy = Bun.YAML.parse(
      readFileSync(join(WORKFLOWS, 'deploy.yml'), 'utf8')
    ) as {
      on: Record<string, unknown>;
      jobs: Record<
        string,
        {
          uses?: string;
          with?: Record<string, string>;
          needs?: string;
          if?: string;
        }
      >;
    };
    expect(Object.keys(deploy.on)).toEqual(['schedule', 'workflow_dispatch']);
    expect(deploy.on['schedule']).toEqual([{ cron: '17 */3 * * *' }]);
    // A pull request runs the fast profile; the release runs every gate task.
    expect(deploy.jobs['deploy-verify']).toMatchObject({
      uses: './.github/workflows/verify-pr.yml',
      needs: 'deploy-changes',
      if: "needs.deploy-changes.outputs.ship == 'true'",
    });
    expect(deploy.jobs['deploy-verify']).toHaveProperty(
      'with.profile',
      'release'
    );
    expect(deploy.jobs['deploy-verify']).toHaveProperty(
      'with.require-main',
      '${{ !inputs.rehearsal }}'
    );
    // A pull request enforced the advisories; Deploy reports what moved since.
    expect(deploy.jobs['deploy-verify']).toHaveProperty(
      'with.advisories',
      'report'
    );
    // Verification, then the fleet, then dev, then production, then the release.
    expect(deploy.jobs['deploy-fleet']!.needs).toBe('deploy-verify');
    expect(deploy.jobs['deploy-dev']!.needs).toBe('deploy-fleet');
    expect(deploy.jobs['deploy-prd']!.needs).toBe('deploy-dev');
    expect(deploy.jobs['deploy-release']!.needs).toBe('deploy-prd');
  });
});
