import { afterEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const HOOKS = join(import.meta.dirname, '../githooks');
const IDENTITY = [
  '-c',
  'user.name=Test',
  '-c',
  'user.email=test@example.com',
  '-c',
  'protocol.file.allow=always',
  '-c',
  'commit.gpgsign=false',
  '-c',
  'init.defaultBranch=main',
];

const roots: string[] = [];
afterEach(() => {
  for (const dir of roots.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

function git(cwd: string, ...args: string[]) {
  const result = spawnSync('git', [...IDENTITY, ...args], {
    cwd,
    encoding: 'utf8',
  });
  return { ...result, out: result.stdout.trim() };
}

function commit(repo: string, file: string): string {
  writeFileSync(join(repo, file), `${file}\n`);
  git(repo, 'add', '-A');
  git(repo, 'commit', '--quiet', '-m', `add ${file}`);
  return git(repo, 'rev-parse', 'HEAD').out;
}

/**
 * A product repository recording a tool repository as the submodule
 * `vendor/tool`, each with its own remote, and the real hooks enabled.
 */
function product() {
  const root = mkdtempSync(join(tmpdir(), 'pre-push-'));
  roots.push(root);
  const toolRemote = join(root, 'tool.git');
  const productRemote = join(root, 'product.git');
  const tool = join(root, 'tool');
  const repo = join(root, 'product');
  for (const remote of [toolRemote, productRemote]) {
    mkdirSync(remote);
    git(remote, 'init', '--quiet', '--bare');
  }
  git(root, 'clone', '--quiet', toolRemote, tool);
  commit(tool, 'first');
  git(tool, 'push', '--quiet', 'origin', 'main');
  git(root, 'clone', '--quiet', productRemote, repo);
  git(repo, 'submodule', '--quiet', 'add', toolRemote, 'vendor/tool');
  git(repo, 'commit', '--quiet', '-m', 'record the tool');
  git(repo, 'push', '--quiet', 'origin', 'main');
  git(repo, 'config', 'core.hooksPath', HOOKS);
  git(repo, 'checkout', '--quiet', '-b', 'feature');
  const record = (sha: string) => {
    const vendored = join(repo, 'vendor/tool');
    git(vendored, 'fetch', '--quiet', 'origin');
    git(vendored, 'checkout', '--quiet', '--detach', sha);
    // The commit hook belongs to the real repository; only the push is under test.
    git(
      repo,
      'commit',
      '--quiet',
      '--no-verify',
      '--allow-empty',
      '-am',
      'record another tool commit'
    );
    return git(repo, 'push', 'origin', 'feature');
  };
  return { tool, record };
}

// regression: atlas-explorer-old-shell
test('a push is refused while it records a submodule commit from a side branch', () => {
  const { tool, record } = product();
  git(tool, 'checkout', '--quiet', '-b', 'side');
  const side = commit(tool, 'redesign');
  git(tool, 'push', '--quiet', 'origin', 'side');

  const refused = record(side);
  expect(refused.status).not.toBe(0);
  expect(refused.stderr).toContain(
    `vendor/tool is recorded at ${side.slice(0, 9)}, which is not on origin/main`
  );

  // The same commit, once it is on the tool's trunk, is recorded freely.
  git(tool, 'checkout', '--quiet', 'main');
  git(tool, 'merge', '--quiet', '--ff-only', 'side');
  git(tool, 'push', '--quiet', 'origin', 'main');
  const accepted = record(side);
  expect(accepted.stderr).not.toContain('is not on');
  expect(accepted.status).toBe(0);
});
