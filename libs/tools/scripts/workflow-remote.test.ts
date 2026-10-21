import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { WORKFLOW_DISPATCH } from './workflow-remote';

const SCROLL_DOWN = '\u001b[B';

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

  // regression: watch-scroll-echo
  // regression: verify-tty-exit-before-output
  test('scroll keys are not echoed while the watch holds the tty', async () => {
    const chunks: Uint8Array[] = [];
    let signalReady!: () => void;
    let signalDone!: () => void;
    const ready = new Promise<void>((resolve) => {
      signalReady = resolve;
    });
    const done = new Promise<void>((resolve) => {
      signalDone = resolve;
    });
    const terminal = new Bun.Terminal({
      cols: 80,
      rows: 24,
      data(_term, data) {
        chunks.push(Uint8Array.from(data));
        const text = Buffer.concat(chunks).toString('utf8');
        if (text.includes('READY')) signalReady();
        if (text.includes('DONE')) signalDone();
      },
    });
    const proc = Bun.spawn(
      ['bun', join(import.meta.dirname, 'workflow-remote-tty-fixture.ts')],
      { terminal }
    );
    const shown = (): string => Buffer.concat(chunks).toString('utf8');
    try {
      await ready;
      expect(shown()).toContain('READY');
      terminal.write(SCROLL_DOWN + SCROLL_DOWN + SCROLL_DOWN);
      await done;
      expect(await proc.exited).toBe(0);
      const out = shown();
      expect(out).toContain('DONE');
      expect(out).not.toContain('^[[B');
      expect(out).not.toContain(SCROLL_DOWN);
    } finally {
      proc.kill();
      terminal.close();
    }
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

  test('Deploy runs on every merge to main and ships only what the full Verify verified', () => {
    const deploy = Bun.YAML.parse(
      readFileSync(join(WORKFLOWS, 'deploy.yml'), 'utf8')
    ) as {
      on: Record<string, unknown>;
      jobs: Record<
        string,
        { uses?: string; with?: Record<string, string>; needs?: string }
      >;
    };
    expect(Object.keys(deploy.on)).toEqual(['push', 'workflow_dispatch']);
    expect(deploy.on['push']).toEqual({ branches: ['main'] });
    expect(deploy.jobs['deploy-verify']).toMatchObject({
      uses: './.github/workflows/verify-pr.yml',
    });
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
