// @io-wall-ok — exercise the PR command against two real git revisions.
import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const root = join(import.meta.dir, '../../..');

// regression: research-brand-first-checked-during-release
// regression: pr-brand-check-excludes-package-readme
test('the PR gate sends every changed workspace path and deployment identity to the brand checker', () => {
  const workflow = Bun.YAML.parse(
    readFileSync(join(root, '.github/workflows/verify-pr.yml'), 'utf8')
  ) as {
    jobs: { 'verify-end': { steps: { name?: string; run?: string }[] } };
  };
  const command = workflow.jobs['verify-end'].steps.find(
    (step) => step.name === 'Check branding in changed workspace files'
  )?.run;
  if (!command) throw new Error('missing PR brand check');

  const cache = join(root, '.cache');
  mkdirSync(cache, { recursive: true });
  const cwd = mkdtempSync(join(cache, 'pr-brand-'));
  const git = (...args: string[]) =>
    execFileSync(
      'git',
      ['-c', 'user.name=test', '-c', 'user.email=test@example.com', ...args],
      { cwd, encoding: 'utf8' }
    ).trim();
  try {
    git('init', '-q');
    git('commit', '-qm', 'base', '--allow-empty');
    const base = git('rev-parse', 'HEAD');
    const file =
      'libs/game-puzzle-client-ts/docs/puzzle-packs/MARKET_RESEARCH.md';
    const readme = 'pkgs/ui-root-client-ts/README.md';
    const source = 'pkgs/ui-root-client-ts/src/board/index.tsx';
    mkdirSync(join(cwd, dirname(file)), { recursive: true });
    writeFileSync(join(cwd, file), '## Direction for Example');
    mkdirSync(join(cwd, dirname(source)), { recursive: true });
    writeFileSync(join(cwd, readme), 'References on pull request #898');
    writeFileSync(join(cwd, source), 'export const name = "Example";');
    writeFileSync(join(cwd, 'README.md'), 'unrelated');
    git('add', '.');
    git('commit', '-qm', 'add research');
    writeFileSync(
      join(cwd, 'bun'),
      '#!/bin/sh\necho "$VERIFY_BRAND_IDENTITY_JSON"\nprintf "%s\\n" "$@"\n',
      { mode: 0o755 }
    );
    const run = (head: string) =>
      execFileSync('bash', ['-ec', command], {
        cwd,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: cwd + ':' + process.env['PATH'],
          PRODUCT_IDENTITY_JSON: '{"example":true}',
          PR_BASE: base,
          PR_HEAD: head,
        },
      }).trim();
    expect(run('HEAD').split('\n')).toEqual([
      '{"example":true}',
      'libs/tools-harness-ts/scripts/verify-brand-policy.ts',
      'README.md',
      file,
      readme,
      source,
    ]);
    expect(run(base)).toBe('');
  } finally {
    removeTree(cwd);
  }
});
