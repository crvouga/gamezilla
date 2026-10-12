import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
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

// regression: chess-model-check-outlasts-one-runner
test("a part replaces its own models' evidence and leaves the other parts'", async () => {
  const root = mkdtempSync(join(tmpdir(), 'model-part-workspace-'));
  const report = join(root, '.cache/harness-report/models');
  const write = (dir: string, path: string, text: string) => {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), text);
  };
  try {
    await withModelWorkspace(
      root,
      async (workspace) => {
        write(workspace, 'evidence/chess-door-qnt.aaaa.json', 'door, first');
        write(workspace, 'tlc/specs-chess-door-qnt/tlc-output.txt', 'door');
      },
      ['specs/chess/door.qnt']
    );
    await withModelWorkspace(
      root,
      async (workspace) => {
        write(workspace, 'evidence/chess-door-lock-qnt.cccc.json', 'lock');
      },
      ['specs/chess/door-lock.qnt']
    );
    // A model whose obligations changed is recorded under another name.
    await withModelWorkspace(
      root,
      async (workspace) => {
        write(workspace, 'evidence/chess-door-qnt.bbbb.json', 'door, second');
      },
      ['specs/chess/door.qnt']
    );
    expect(readdirSync(join(report, 'evidence')).sort()).toEqual([
      'chess-door-lock-qnt.cccc.json',
      'chess-door-qnt.bbbb.json',
    ]);
    expect(existsSync(join(report, 'tlc/specs-chess-door-qnt'))).toBe(false);
    // The unsplit check still replaces the whole report.
    await withModelWorkspace(root, async (workspace) => {
      write(workspace, 'evidence/chess-key-qnt.dddd.json', 'key');
    });
    expect(readdirSync(join(report, 'evidence'))).toEqual([
      'chess-key-qnt.dddd.json',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
