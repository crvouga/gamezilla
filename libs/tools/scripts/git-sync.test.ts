import { describe, expect, test } from 'bun:test';

import {
  parseGitSyncArgs,
  parsePorcelainPaths,
  SyncError,
  secretLookingPaths,
  validateCommitMessage,
  worktreeForBranch,
} from './git-sync';

describe('validateCommitMessage', () => {
  test('accepts a conventional header with an optional body', () => {
    expect(validateCommitMessage('feat(sync): drain mutations')).toEqual([]);
    expect(
      validateCommitMessage('fix: guard null actor\n\nThe actor can be null.')
    ).toEqual([]);
  });

  test('rejects an unknown type, a full stop, and a missing blank line', () => {
    expect(validateCommitMessage('update stuff')).toHaveLength(1);
    expect(validateCommitMessage('fix: trailing stop.')).toHaveLength(1);
    expect(validateCommitMessage('fix: header\nbody')).toHaveLength(1);
  });

  test('rejects an empty or overlong header', () => {
    expect(validateCommitMessage('  ')).toEqual(['Commit message is empty.']);
    expect(validateCommitMessage(`chore: ${'x'.repeat(80)}`)).toHaveLength(1);
  });
});

describe('secretLookingPaths', () => {
  test('flags env files, keys, and the local secrets cache', () => {
    expect(
      secretLookingPaths([
        'apps/client/.env.local',
        '.env',
        'certs/server.pem',
        '.cache/secrets/dev.json',
        'home/id_ed25519',
      ])
    ).toHaveLength(5);
  });

  test('leaves source, examples, and tracked config alone', () => {
    expect(
      secretLookingPaths([
        '.env.example',
        '.secrets.json',
        'libs/secrets/src/shared/secrets/registry.ts',
        'pkgs/ui/src/components/key/key.tsx',
      ])
    ).toEqual([]);
  });
});

describe('parsePorcelainPaths', () => {
  test('reads plain entries and both sides of a rename', () => {
    const output = ' M a.ts\0?? dir/b.ts\0R  new.ts\0old.ts\0';
    expect(parsePorcelainPaths(output)).toEqual([
      'a.ts',
      'dir/b.ts',
      'new.ts',
      'old.ts',
    ]);
  });
});

describe('parseGitSyncArgs', () => {
  test('reads the message and both mode flags', () => {
    expect(parseGitSyncArgs(['-m', 'fix: x', '--leave-conflicts'])).toEqual({
      message: 'fix: x',
      trunkOnly: false,
      leaveConflicts: true,
    });
    expect(parseGitSyncArgs(['--trunk-only']).trunkOnly).toBe(true);
  });

  test('rejects unknown flags and a message with --trunk-only', () => {
    expect(() => parseGitSyncArgs(['--force'])).toThrow(SyncError);
    expect(() =>
      parseGitSyncArgs(['--trunk-only', '--message', 'fix: x'])
    ).toThrow(SyncError);
  });
});

describe('worktreeForBranch', () => {
  const porcelain = [
    'worktree /repo',
    'HEAD 593934ea9',
    'branch refs/heads/local',
    '',
    'worktree /wt/a',
    'HEAD 19d0f00b7',
    'branch refs/heads/main',
    '',
    'worktree /wt/b',
    'HEAD 29269e3d2',
    'detached',
  ].join('\n');

  test('finds the worktree that has the branch checked out', () => {
    expect(worktreeForBranch(porcelain, 'main')).toBe('/wt/a');
  });

  test('returns null when no worktree has it, and ignores prefixes', () => {
    expect(worktreeForBranch(porcelain, 'mai')).toBeNull();
    expect(worktreeForBranch(porcelain, 'feature')).toBeNull();
  });
});
