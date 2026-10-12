#!/usr/bin/env bun
// @io-wall-ok — Turbo check entry validates the worker's declared hosting.
import { spawnSync } from 'node:child_process';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '../../..');
const foundation = resolve(root, 'libs/infra-shared/tofu/stacks/foundation');
process.env['TF_VAR_state_passphrase'] ??= 'ci-provider-validation-only';

for (const args of [['init', '-backend=false', '-input=false'], ['validate']]) {
  const result = spawnSync('tofu', args, {
    cwd: foundation,
    stdio: 'inherit',
    env: process.env,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
