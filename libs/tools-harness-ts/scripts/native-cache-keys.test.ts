import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '../../..');
const LIB = 'pkgs/clock-shared-swift';
const APP = 'apps/client-swift';

type DryTask = { taskId: string; hash: string; command: string };

/**
 * A workspace holding the repo's real Turbo configuration for the Swift
 * library and the app that links it, beside an unrelated TypeScript
 * package, with stand-in sources.
 */
function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'native-cache-keys-'));
  const write = (path: string, text: string) => {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  };
  write('.gitignore', 'node_modules/\n.turbo/\n');
  write(
    'package.json',
    JSON.stringify({
      name: 'fixture',
      private: true,
      packageManager: `bun@${Bun.version}`,
      workspaces: ['apps/*', 'pkgs/*'],
    })
  );
  write('turbo.json', readFileSync(join(ROOT, 'turbo.json'), 'utf8'));
  write('mise.toml', readFileSync(join(ROOT, 'mise.toml'), 'utf8'));
  write('tsconfig.base.json', '{}\n');
  write('turbo-host-key.json', '{"platform":"darwin","arch":"arm64"}\n');
  for (const script of [
    'native-toolchain.ts',
    'package-hosts.ts',
    'swift-task.ts',
    'xcode-task.ts',
  ])
    cpSync(
      join(ROOT, 'libs/tools-harness-ts/scripts', script),
      join(root, 'libs/tools-harness-ts/scripts', script),
      { recursive: true }
    );
  for (const dir of [LIB, APP]) {
    write(
      `${dir}/package.json`,
      readFileSync(join(ROOT, dir, 'package.json'), 'utf8')
    );
    write(
      `${dir}/turbo.json`,
      readFileSync(join(ROOT, dir, 'turbo.json'), 'utf8')
    );
  }
  write(`${LIB}/Package.swift`, '// swift-tools-version: 6.0\n');
  write(`${LIB}/src/clock.swift`, 'public struct Clock {}\n');
  write(`${LIB}/tests/clock-tests.swift`, 'import Testing\n');
  write(`${APP}/src/app.swift`, 'import SwiftUI\n');
  write(
    'pkgs/other-shared-ts/package.json',
    JSON.stringify({
      name: '@pkgs/other-shared-ts',
      private: true,
      scripts: { test: 'bun test tests' },
    })
  );
  write('pkgs/other-shared-ts/src/value.ts', 'export const value = 1;\n');
  execFileSync('git', ['init', '-q'], { cwd: root });
  execFileSync('git', ['add', '.'], { cwd: root });
  execFileSync(
    'git',
    ['-c', 'user.email=f@x', '-c', 'user.name=f', 'commit', '-qm', 'fixture'],
    { cwd: root }
  );
  execFileSync('bun', ['install', '--silent'], { cwd: root });
  return root;
}

function hashes(root: string): Map<string, string> {
  const json = execFileSync(
    join(ROOT, 'node_modules/.bin/turbo'),
    [
      'run',
      'tc',
      'test',
      '--filter=./apps/*',
      '--filter=./pkgs/*',
      '--dry=json',
      '--framework-inference=false',
    ],
    {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, TURBO_TELEMETRY_DISABLED: '1' },
    }
  );
  // A package without the script has a hash but no task to run.
  return new Map(
    (JSON.parse(json) as { tasks: DryTask[] }).tasks
      .filter((task) => task.command !== '<NONEXISTENT>')
      .map((task) => [task.taskId, task.hash])
  );
}

function changed(
  before: ReadonlyMap<string, string>,
  after: ReadonlyMap<string, string>
): readonly string[] {
  return [...after.keys()]
    .filter((id) => before.get(id) !== after.get(id))
    .sort();
}

test('a native library change reruns its app, a test change does not, and other packages stay cached', () => {
  const root = fixture();
  try {
    const base = hashes(root);
    expect(base.has('@apps/client-swift#test')).toBe(true);
    // The unrelated TypeScript package is in the plan, so staying out of
    // every `changed` list below means it stayed cached.
    expect(base.has('@pkgs/other-shared-ts#test')).toBe(true);

    writeFileSync(
      join(root, LIB, 'src/clock.swift'),
      'public struct Clock { }\n'
    );
    const source = hashes(root);
    expect(changed(base, source)).toEqual([
      '@apps/client-swift#test',
      '@pkgs/clock-shared-swift#tc',
      '@pkgs/clock-shared-swift#test',
    ]);

    writeFileSync(
      join(root, LIB, 'tests/clock-tests.swift'),
      'import Testing\n\n'
    );
    expect(changed(source, hashes(root))).toEqual([
      '@pkgs/clock-shared-swift#tc',
      '@pkgs/clock-shared-swift#test',
    ]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a native verdict never answers for another host or toolchain', () => {
  const root = fixture();
  try {
    const native = [
      '@apps/client-swift#test',
      '@pkgs/clock-shared-swift#tc',
      '@pkgs/clock-shared-swift#test',
    ];
    const base = hashes(root);
    writeFileSync(
      join(root, 'turbo-host-key.json'),
      '{"platform":"linux","arch":"x64"}\n'
    );
    const host = hashes(root);
    expect(changed(base, host)).toEqual(native);
    // Swift and Xcode are pinned in mise.toml, a global dependency.
    const mise = readFileSync(join(root, 'mise.toml'), 'utf8');
    writeFileSync(
      join(root, 'mise.toml'),
      mise.replace(/xcode_version = "[^"]+"/, 'xcode_version = "0.0"')
    );
    expect(changed(host, hashes(root))).toEqual(expect.arrayContaining(native));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
