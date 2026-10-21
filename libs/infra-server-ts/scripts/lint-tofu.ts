#!/usr/bin/env bun
// @io-wall-ok — lint CLI: runs tofu / conftest over this package's files.
/**
 * Static checks for the OpenTofu configuration — no credentials, no state:
 *
 *   - `tofu fmt -check`       formatting
 *   - `tofu validate`         each stack, after `init -backend=false`
 *   - `tflint`                language errors across stacks and local modules
 *   - `conftest verify`       the policy's own Rego unit tests
 *   - `conftest fmt --check`  policy formatting
 *
 * Providers are cached under `.cache/tofu/plugins`, keyed by the committed
 * `.terraform.lock.hcl`, so a warm run never downloads.
 */
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tofuLayout } from '@libs/infra-server-ts/tofu-layout';
import { STACKS } from '@libs/infra-shared-ts/tofu-command';
import { pinnedTool } from './tofu-process';

const PKG_DIR = join(import.meta.dirname, '..');
const { paths: PATHS, policyDir: POLICY_DIR } = tofuLayout(PKG_DIR);
const CACHE = PATHS.cacheDir;
mkdirSync(join(CACHE, 'plugins'), { recursive: true });

/** One tool run; the checks are independent, so they run concurrently. */
async function step(
  label: string,
  cmd: readonly string[],
  env: Record<string, string> = {}
): Promise<boolean> {
  const [bin = '', ...rest] = cmd;
  const child = Bun.spawn([...pinnedTool(bin), ...rest], {
    cwd: PKG_DIR,
    env: { ...process.env, TF_IN_AUTOMATION: '1', TF_INPUT: '0', ...env },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode === 0) return true;
  console.error(`✗ ${label}\n${stdout}${stderr}`);
  return false;
}

async function stackOk(stack: string): Promise<boolean> {
  const env = {
    TF_DATA_DIR: join(CACHE, 'lint', stack),
    TF_PLUGIN_CACHE_DIR: join(CACHE, 'plugins'),
  };
  const chdir = `-chdir=${join(PATHS.tofuDir, 'stacks', stack)}`;
  return (
    (await step(
      `tofu init (${stack})`,
      ['tofu', chdir, 'init', '-backend=false', '-lockfile=readonly'],
      env
    )) &&
    (await step(`tofu validate (${stack})`, ['tofu', chdir, 'validate'], env))
  );
}

const results = await Promise.all([
  step(
    'tofu fmt -check (run `tofu fmt -recursive libs/infra-shared-ts/tofu`)',
    ['tofu', 'fmt', '-check', '-recursive', PATHS.tofuDir]
  ),
  step('conftest verify', ['conftest', 'verify', '--policy', POLICY_DIR]),
  step('conftest fmt --check', ['conftest', 'fmt', '--check', POLICY_DIR]),
  step('tflint', [
    'tflint',
    '--config',
    join(PKG_DIR, 'tflint.hcl'),
    '--recursive',
    '--chdir',
    PATHS.tofuDir,
  ]),
  // Stacks init one after another: they share the provider cache.
  (async () => {
    let ok = true;
    for (const stack of STACKS) ok = (await stackOk(stack)) && ok;
    return ok;
  })(),
]);
if (results.includes(false)) process.exit(1);
console.log('tofu: fmt, validate, tflint and policy tests pass');
