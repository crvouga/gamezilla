import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';
import { withModelWorkspace } from './model-verify-workspace';

test('an unsplit verification preserves another running checker source', async () => {
  // regression: model-verify-report-ownership
  const root = mkdtempSync(join(tmpdir(), 'model-report-owner-'));
  const report = join(root, '.cache/harness-report/models');
  const source = join(report, 'identity-machine/cached-source/identity.qnt');
  mkdirSync(join(source, '..'), { recursive: true });
  writeFileSync(source, 'module identity { pure val authValid = true }');
  try {
    await withModelWorkspace(root, async () => {}, [
      'specs/developer-tools/checkpoints.qnt',
    ]);
    expect(readFileSync(source, 'utf8')).toContain('authValid');
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

// regression: overlapping-model-verify-workspaces
test('overlapping verifications publish evidence without deleting a running solver directory', async () => {
  const root = mkdtempSync(join(tmpdir(), 'model-workspaces-'));
  const report = join(root, '.cache/harness-report/models');
  let first = '';
  try {
    await withModelWorkspace(
      root,
      async (workspace) => {
        first = workspace;
        const cwd = join(workspace, 'apalache/specs-spaces-space-hosting-qnt');
        mkdirSync(cwd, { recursive: true });
        writeFileSync(join(cwd, 'running'), 'live JVM');
        await withModelWorkspace(
          root,
          async (second) => {
            expect(second).not.toBe(first);
            writeFileSync(join(second, 'verdict.json'), 'second');
          },
          ['specs/spaces/another-room.qnt']
        );
        expect(readFileSync(join(cwd, 'running'), 'utf8')).toBe('live JVM');
        expect(readFileSync(join(report, 'verdict.json'), 'utf8')).toBe(
          'second'
        );
        // A cached report restore must also leave this invocation alive.
        removeTree(report, { whenLocked: 'leave' });
        expect(existsSync(cwd)).toBe(true);
        writeFileSync(join(workspace, 'verdict.json'), 'first');
      },
      ['specs/spaces/space-hosting.qnt']
    );
    expect(readFileSync(join(report, 'verdict.json'), 'utf8')).toBe('first');
    expect(existsSync(join(report, 'apalache'))).toBe(false);
    expect(existsSync(first)).toBe(false);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

// regression: overlapping-model-verify-workspaces
test('a failed checker still publishes its diagnostics and releases scratch', async () => {
  const root = mkdtempSync(join(tmpdir(), 'model-failed-workspace-'));
  let workspace = '';
  try {
    await expect(
      withModelWorkspace(
        root,
        async (path) => {
          workspace = path;
          writeFileSync(join(path, 'verdict.json'), 'failed');
          throw new Error('checker failed');
        },
        ['specs/system/failure.qnt']
      )
    ).rejects.toThrow('checker failed');
    expect(
      readFileSync(
        join(root, '.cache/harness-report/models/verdict.json'),
        'utf8'
      )
    ).toBe('failed');
    expect(existsSync(workspace)).toBe(false);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

// regression: chess-model-verify-outlasts-one-runner
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
    // A complete run clears all of its owned models, retaining other writers.
    await withModelWorkspace(
      root,
      async (workspace) => {
        write(workspace, 'evidence/chess-key-qnt.dddd.json', 'key');
      },
      [
        'specs/chess/door.qnt',
        'specs/chess/door-lock.qnt',
        'specs/chess/key.qnt',
      ]
    );
    expect(readdirSync(join(report, 'evidence'))).toEqual([
      'chess-key-qnt.dddd.json',
    ]);
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});
