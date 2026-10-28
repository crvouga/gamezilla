import { expect, test } from 'bun:test';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';
import { writeHostKey } from './package-hosts';
import { applyPlanContext } from './verify-shard-run';

const REPO = join(import.meta.dirname, '../../..');

function rootLintHash(root: string): string {
  // The turbo bin is a JS launcher, not an executable on Windows: run it
  // through Bun so it starts the platform binary on every OS.
  const result = execFileSync(
    process.execPath,
    [
      join(REPO, 'node_modules/turbo/bin/turbo'),
      'run',
      'lint',
      '--framework-inference=false',
      '--cache=local:rw',
      '--no-daemon',
      '--dry=json',
    ],
    { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }
  );
  return (JSON.parse(result) as { tasks: { hash: string }[] }).tasks[0]!.hash;
}

// regression: verify-non-browser-host-fingerprint
test('a non-browser shard restores the host fingerprint used by root lint', () => {
  const root = mkdtempSync(join(tmpdir(), 'verify-plan-context-'));
  try {
    const config = JSON.parse(
      readFileSync(join(REPO, 'turbo.json'), 'utf8')
    ) as {
      tasks: Record<string, { inputs: string[] }>;
    };
    writeFileSync(join(root, '.gitignore'), '.cache/\nturbo-*-key.json\n');
    writeFileSync(
      join(root, 'package.json'),
      JSON.stringify({
        name: 'fixture',
        packageManager: `bun@${Bun.version}`,
        scripts: { lint: 'echo lint' },
      })
    );
    writeFileSync(
      join(root, 'turbo.json'),
      JSON.stringify({
        tasks: {
          lint: {
            inputs:
              config.tasks['@libs/tools-harness-ts#verify:root-lint']!.inputs,
            outputs: [],
          },
        },
      })
    );
    mkdirSync(join(root, '.cache/verify-ci'), { recursive: true });
    const platformKey = JSON.stringify({
      platform: process.platform,
      arch: process.arch,
      bun: Bun.version,
      chrome: 'pinned-browser',
    });
    writeFileSync(
      join(root, '.cache/verify-ci/context.json'),
      JSON.stringify({
        secretsRange: 'base..head',
        platformKey,
      })
    );
    writeFileSync(join(root, 'turbo-platform-key.json'), platformKey);
    writeHostKey(root);
    const planned = rootLintHash(root);
    rmSync(join(root, 'turbo-host-key.json'));
    const env: NodeJS.ProcessEnv = {};
    applyPlanContext(env, root);
    expect(rootLintHash(root)).toBe(planned);
    expect(readFileSync(join(root, 'turbo-host-key.json'), 'utf8')).toContain(
      process.platform
    );
    expect(env['VERIFY_SECRETS_RANGE']).toBe('base..head');
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});

test('a shard without a browser restores both planned platform fingerprints', () => {
  // regression: verify-nonbrowser-host-key-missing
  const root = mkdtempSync(join(tmpdir(), 'verify-plan-context-'));
  try {
    const directory = join(root, '.cache/verify-ci');
    mkdirSync(directory, { recursive: true });
    const platformKey = JSON.stringify({
      platform: process.platform,
      arch: process.arch,
      bun: Bun.version,
      chrome: '154.0.8037.92',
    });
    writeFileSync(
      join(directory, 'context.json'),
      JSON.stringify({
        secretsRange: 'base..head',
        platformKey,
      })
    );
    applyPlanContext({}, root);
    expect(
      JSON.parse(readFileSync(join(root, 'turbo-host-key.json'), 'utf8'))
    ).toEqual({
      platform: process.platform,
      arch: process.arch,
    });
    expect(readFileSync(join(root, 'turbo-platform-key.json'), 'utf8')).toBe(
      platformKey
    );
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
});
