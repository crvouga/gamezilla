#!/usr/bin/env bun
// @io-wall-ok — lint CLI: runs tofu / conftest over this package's files.
/**
 * Static checks for the OpenTofu configuration — no credentials, no state:
 *
 *   - `tofu fmt -check`       formatting
 *   - `tofu validate`         each stack, after `init -backend=false`
 *   - `conftest verify`       the policy's own Rego unit tests
 *   - `conftest fmt --check`  policy formatting
 *
 * Providers are cached under `.cache/tofu/plugins`, keyed by the committed
 * `.terraform.lock.hcl`, so a warm run never downloads.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { STACKS } from '@libs/infra/public/tofu-command';

const PKG_DIR = join(import.meta.dirname, '..');
const CACHE = join(PKG_DIR, '.cache/tofu');
mkdirSync(join(CACHE, 'plugins'), { recursive: true });

function step(
  label: string,
  cmd: readonly string[],
  env: Record<string, string> = {}
): boolean {
  const result = Bun.spawnSync([...cmd], {
    cwd: PKG_DIR,
    env: { ...process.env, TF_IN_AUTOMATION: '1', TF_INPUT: '0', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode === 0) return true;
  console.error(
    `✗ ${label}\n${result.stdout.toString()}${result.stderr.toString()}`
  );
  return false;
}

const results = [
  step('tofu fmt -check (run `tofu fmt -recursive libs/infra/tofu`)', [
    'tofu',
    'fmt',
    '-check',
    '-recursive',
    'tofu',
  ]),
  step('conftest verify', ['conftest', 'verify', '--policy', 'policy']),
  step('conftest fmt --check', ['conftest', 'fmt', '--check', 'policy']),
];
for (const stack of STACKS) {
  const env = {
    TF_DATA_DIR: join(CACHE, 'lint', stack),
    TF_PLUGIN_CACHE_DIR: join(CACHE, 'plugins'),
  };
  const chdir = `-chdir=tofu/stacks/${stack}`;
  results.push(
    step(
      `tofu init (${stack})`,
      ['tofu', chdir, 'init', '-backend=false', '-lockfile=readonly'],
      env
    ) && step(`tofu validate (${stack})`, ['tofu', chdir, 'validate'], env)
  );
}
if (results.includes(false)) process.exit(1);
console.log('tofu: fmt, validate and policy tests pass');
