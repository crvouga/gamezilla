import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withModelWorkspace } from './model-check-workspace';

// regression: overlapping-model-check-workspaces
test('overlapping checks publish evidence without deleting a running solver directory', async () => {
  const root = mkdtempSync(join(tmpdir(), 'model-workspaces-'));
  const report = join(root, '.cache/harness-report/models');
  let first = '';
  try {
    await withModelWorkspace(root, async (workspace) => {
      first = workspace;
      const cwd = join(workspace, 'apalache/specs-spaces-space-hosting-qnt');
      mkdirSync(cwd, { recursive: true });
      writeFileSync(join(cwd, 'running'), 'live JVM');
      await withModelWorkspace(root, async (second) => {
        expect(second).not.toBe(first);
        writeFileSync(join(second, 'verdict.json'), 'second');
      });
      expect(readFileSync(join(cwd, 'running'), 'utf8')).toBe('live JVM');
      expect(readFileSync(join(report, 'verdict.json'), 'utf8')).toBe('second');
      // A cached report restore must also leave this invocation alive.
      rmSync(report, { recursive: true, force: true });
      expect(existsSync(cwd)).toBe(true);
      writeFileSync(join(workspace, 'verdict.json'), 'first');
    });
    expect(readFileSync(join(report, 'verdict.json'), 'utf8')).toBe('first');
    expect(existsSync(join(report, 'apalache'))).toBe(false);
    expect(existsSync(first)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// regression: overlapping-model-check-workspaces
test('a failed checker still publishes its diagnostics and releases scratch', async () => {
  const root = mkdtempSync(join(tmpdir(), 'model-failed-workspace-'));
  let workspace = '';
  try {
    await expect(
      withModelWorkspace(root, async (path) => {
        workspace = path;
        writeFileSync(join(path, 'verdict.json'), 'failed');
        throw new Error('checker failed');
      })
    ).rejects.toThrow('checker failed');
    expect(
      readFileSync(
        join(root, '.cache/harness-report/models/verdict.json'),
        'utf8'
      )
    ).toBe('failed');
    expect(existsSync(workspace)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
