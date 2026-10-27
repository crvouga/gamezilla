import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { archiveVerifySnapshot } from './verify-snapshot-archive';

test('diagnostics retain failures and exclude the local credential cache', async () => {
  // regression: snapshot-archive-credential-cache
  const container = mkdtempSync(join(tmpdir(), 'archive-credentials-'));
  const root = join(container, 'workspace');
  mkdirSync(join(root, '.cache/secrets'), { recursive: true });
  mkdirSync(join(root, '.cache/harness-report'), { recursive: true });
  writeFileSync(
    join(root, '.cache/secrets/token.json'),
    '{"token":"literal-private-fixture"}'
  );
  writeFileSync(
    join(root, '.cache/harness-report/failure.log'),
    'literal failing input retained'
  );
  try {
    const archive = await archiveVerifySnapshot(root);
    // Relative names: GNU tar (Git Bash on Windows) misreads `C:\…` paths.
    const tar = (...args: string[]) =>
      execFileSync('tar', args, { cwd: dirname(archive), encoding: 'utf8' });
    expect(tar('-tzf', basename(archive))).not.toContain('.cache/secrets');
    expect(
      tar('-xOf', basename(archive), './.cache/harness-report/failure.log')
    ).toBe('literal failing input retained');
    expect(existsSync(root)).toBe(false);
  } finally {
    rmSync(container, { recursive: true, force: true });
  }
});
