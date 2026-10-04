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
import { dirname, join } from 'node:path';
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
    // regression: check-snapshot-head-race
    const head = git('rev-parse', 'HEAD').toString().trim();
    const pending = Promise.all([
      createCheckSnapshot(source),
      createCheckSnapshot(source),
    ]);
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.com',
      'commit',
      '--allow-empty',
      '-qm',
      'concurrent commit'
    );
    runs.push(...(await pending));
    const [first, second] = runs as [string, string];
    expect(first).not.toBe(second);
    for (const root of runs) {
      expect(
        execFileSync('git', ['rev-parse', 'HEAD'], {
          cwd: root,
          encoding: 'utf8',
        }).trim()
      ).toBe(head);
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
    for (const root of [...runs.map(dirname), source])
      rmSync(root, { recursive: true, force: true });
  }
});

// regression: check-snapshot-dependency-copy-overhead
test('frozen offline installation reconstructs workspace imports inside the private run', async () => {
  const source = mkdtempSync(join(tmpdir(), 'check-install-fixture-'));
  let run: string | undefined;
  try {
    const git = (...args: string[]) =>
      execFileSync('git', args, { cwd: source, stdio: 'pipe' });
    git('init', '-q');
    writeFileSync(join(source, '.gitignore'), 'node_modules/\n');
    writeFileSync(
      join(source, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        workspaces: ['pkgs/*'],
        dependencies: { example: 'workspace:*' },
      })
    );
    mkdirSync(join(source, 'pkgs/example'), { recursive: true });
    writeFileSync(
      join(source, 'pkgs/example/package.json'),
      JSON.stringify({
        name: 'example',
        version: '1.0.0',
        exports: './index.ts',
      })
    );
    writeFileSync(join(source, 'pkgs/example/index.ts'), 'export default 42;');
    execFileSync(
      process.execPath,
      ['install', '--offline', '--ignore-scripts'],
      { cwd: source, stdio: 'pipe' }
    );
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
    run = await createCheckSnapshot(source);
    writeFileSync(join(source, 'pkgs/example/index.ts'), 'export default 0;');
    const result = execFileSync(
      process.execPath,
      ['-e', "import value from 'example'; console.log(value)"],
      { cwd: run, encoding: 'utf8' }
    );
    expect(result.trim()).toBe('42');
    expect(readFileSync(join(run, 'bun.lock'), 'utf8')).toBe(
      readFileSync(join(source, 'bun.lock'), 'utf8')
    );
  } finally {
    for (const path of [run === undefined ? undefined : dirname(run), source])
      if (path) rmSync(path, { recursive: true, force: true });
  }
});

// regression: private-check-temp-inherits-gitignore
test('run temporary fixtures have no enclosing Git repository', async () => {
  const source = mkdtempSync(join(tmpdir(), 'check-temp-fixture-'));
  let run: string | undefined;
  try {
    execFileSync('git', ['init', '-q'], { cwd: source });
    writeFileSync(join(source, 'input'), 'fixture');
    execFileSync('git', ['add', '.'], { cwd: source });
    execFileSync(
      'git',
      [
        '-c',
        'user.name=Fixture',
        '-c',
        'user.email=fixture@example.com',
        'commit',
        '-qm',
        'fixture',
      ],
      { cwd: source }
    );
    run = await createCheckSnapshot(source);
    const temporary = join(dirname(run), 'tmp');
    mkdirSync(temporary);
    expect(() =>
      execFileSync('git', ['rev-parse', '--show-toplevel'], {
        cwd: temporary,
        stdio: 'pipe',
      })
    ).toThrow();
  } finally {
    for (const path of [run === undefined ? undefined : dirname(run), source])
      if (path) rmSync(path, { recursive: true, force: true });
  }
});
