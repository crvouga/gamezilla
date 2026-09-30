import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { findNewRun, WORKFLOW_DISPATCH } from './workflow-remote';

const WORKFLOWS = join(import.meta.dirname, '../../../.github/workflows');

describe('findNewRun', () => {
  const runs = [
    { databaseId: 3, headSha: 'other' },
    { databaseId: 2, headSha: 'abc' },
    { databaseId: 1, headSha: 'abc' },
  ];

  test('picks the run created after the snapshot on our commit', () => {
    expect(findNewRun(runs, new Set([1]), 'abc')?.databaseId).toBe(2);
  });

  test('ignores runs that already existed or are on another commit', () => {
    expect(findNewRun(runs, new Set([1, 2]), 'abc')).toBeUndefined();
  });
});

describe('WORKFLOW_DISPATCH', () => {
  test('check and health follow the checkout; deploy ships main', () => {
    expect(WORKFLOW_DISPATCH.check).toEqual({
      workflow: 'check.yml',
      sync: 'branch',
      refuseOnMain: true,
      printsReport: true,
    });
    expect(WORKFLOW_DISPATCH.health).toEqual({
      workflow: 'health.yml',
      sync: 'branch',
      refuseOnMain: false,
      printsReport: false,
    });
    expect(WORKFLOW_DISPATCH.deploy).toEqual({
      workflow: 'deploy.yml',
      sync: 'trunk',
      refuseOnMain: false,
      printsReport: false,
    });
  });

  test('workflow jobs call the local runners', () => {
    const health = readFileSync(join(WORKFLOWS, 'health.yml'), 'utf8');
    const deploy = readFileSync(join(WORKFLOWS, 'deploy.yml'), 'utf8');
    expect(health).toContain('run: bun run health:local');
    expect(health).not.toContain('run: bun run health\n');
    expect(deploy).toContain('run: bun run deploy:local');
    expect(deploy).not.toContain('run: bun run deploy\n');
    expect(deploy).toContain('refs/heads/main');
  });
});
