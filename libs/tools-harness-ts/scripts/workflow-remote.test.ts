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
  test('Release keeps the newest pending commit without interrupting an active deployment', () => {
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
      group:
        "${{ inputs.rehearsal && format('deploy-rehearsal-{0}', github.ref) || 'deploy-main' }}",
      'cancel-in-progress': false,
    });
    // Both stages select the safety gate; nightly owns the complete catalog.
    expect(deploy.jobs['deploy-verify']).toMatchObject({
      uses: './.github/workflows/verify-full.yml',
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
    // Verification, then fleet, dev and production in order beside
    // repository policy and the Storybook site, then the release tag.
    expect(deploy.jobs['deploy-repository-policy']!.needs).toBe(
      'deploy-verify'
    );
    expect(deploy.jobs['deploy-storybook']!.needs).toBe('deploy-verify');
    expect(deploy.jobs['deploy-fleet']!.needs).toEqual([
      'deploy-verify',
      'deploy-await-health',
    ]);
    expect(deploy.jobs['deploy-dev']!.needs).toBe('deploy-fleet');
    expect(deploy.jobs['deploy-prd']!.needs).toEqual([
      'deploy-fleet',
      'deploy-repository-policy',
    ]);
    expect(deploy.jobs['deploy-release']!.needs).toEqual([
      'deploy-prd',
      'deploy-repository-policy',
    ]);
  });

  test('every Release job stops within 10 minutes, and a rehearsal is titled apart', () => {
    const deploy = Bun.YAML.parse(
      readFileSync(join(WORKFLOWS, 'deploy.yml'), 'utf8')
    ) as {
      'run-name': string;
      jobs: Record<string, { uses?: string; 'timeout-minutes'?: number }>;
    };
    for (const [id, job] of Object.entries(deploy.jobs)) {
      if (job.uses !== undefined) continue;
      expect(job['timeout-minutes'], id).toBeLessThanOrEqual(10);
    }
    expect(deploy['run-name']).toStartWith(
      "Release · ${{ inputs.rehearsal && 'rehearsal' || "
    );
  });
});
