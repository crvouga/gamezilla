import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCheckSnapshot } from './check-snapshot';

// regression: concurrent-check-run-isolation
test('overlapping runs isolate dirty inputs, workspace imports, logs, restores and Git metadata', async () => {
  const source = mkdtempSync(join(tmpdir(), 'check-isolation-fixture-'));
  const runs: string[] = [];
  try {
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: source, stdio: 'pipe' });
    git('init', '-q');
    writeFileSync(
      join(source, '.gitignore'),
      'node_modules/\n.cache/\n.turbo/\ndist/\n'
    );
    writeFileSync(join(source, 'input.ts'), 'committed');
    git('add', '.');
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '-qm',
      'fixture'
    );
    writeFileSync(join(source, 'input.ts'), 'dirty input');
    writeFileSync(join(source, 'untracked.ts'), 'new input');
    mkdirSync(join(source, 'node_modules'), { recursive: true });
    symlinkSync(
      join(source, 'input.ts'),
      join(source, 'node_modules/input.ts')
    );
    mkdirSync(join(source, '.cache'), { recursive: true });
    writeFileSync(join(source, '.cache/evidence.json'), 'stale');
    runs.push(
      ...(await Promise.all([
        createCheckSnapshot(source),
        createCheckSnapshot(source),
      ]))
    );
    const [first, second] = runs as [string, string];
    expect(first).not.toBe(second);
    for (const root of runs) {
      expect(readFileSync(join(root, 'node_modules/input.ts'), 'utf8')).toBe(
        'dirty input'
      );
      expect(readFileSync(join(root, 'untracked.ts'), 'utf8')).toBe(
        'new input'
      );
      expect(existsSync(join(root, '.cache/evidence.json'))).toBe(false);
      for (const path of ['.cache', '.turbo', 'dist'])
        mkdirSync(join(root, path));
      writeFileSync(join(root, '.cache/evidence.json'), root);
      writeFileSync(join(root, '.turbo/task.log'), root);
      writeFileSync(join(root, 'dist/bundle.js'), root);
    }
    writeFileSync(join(first, 'input.ts'), 'mutated by first');
    rmSync(join(first, '.cache'), { recursive: true });
    rmSync(join(first, '.git'), { recursive: true });
    expect(readFileSync(join(second, 'node_modules/input.ts'), 'utf8')).toBe(
      'dirty input'
    );
    expect(readFileSync(join(source, 'input.ts'), 'utf8')).toBe('dirty input');
    for (const path of [
      '.cache/evidence.json',
      '.turbo/task.log',
      'dist/bundle.js',
    ])
      expect(readFileSync(join(second, path), 'utf8')).toBe(second);
    expect(
      execFileSync('git', ['show', 'HEAD:input.ts'], {
        cwd: second,
        encoding: 'utf8',
      })
    ).toBe('committed');
    expect(readFileSync(join(source, '.cache/evidence.json'), 'utf8')).toBe(
      'stale'
    );
  } finally {
    for (const root of [...runs, source])
      rmSync(root, { recursive: true, force: true });
  }
});
