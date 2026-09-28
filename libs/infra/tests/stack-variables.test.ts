import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_FILES } from '@libs/infra/public/envs';
import { GLOBAL } from '@libs/infra/public/global';
import {
  CREDENTIAL_ENV,
  GLOBAL_STACKS,
  STACKS,
} from '@libs/infra/public/tofu-command';

/**
 * `tofu validate` never sees variable values, so a stack that still requires
 * a variable no var file sets only fails at plan time — mid-deploy. This
 * pins, offline, that every required variable of every stack is set by the
 * files `scripts/tofu.ts` passes (global, then the env's) or by the
 * `TF_VAR_*` the wrapper exports.
 */
const STACKS_DIR = join(import.meta.dirname, '../tofu/stacks');

/**
 * `TF_VAR_*` that `scripts/tofu.ts` / `tofu-command.ts` export: the stack's
 * credential mapping, plus the Infisical token `tofu.ts` mints itself.
 */
function fromWrapper(stack: (typeof STACKS)[number]): Set<string> {
  const names = Object.keys(CREDENTIAL_ENV[stack])
    .filter((key) => key.startsWith('TF_VAR_'))
    .map((key) => key.slice('TF_VAR_'.length));
  return new Set([...names, 'infisical_token']);
}

function requiredVariables(stack: string): string[] {
  const hcl = readFileSync(join(STACKS_DIR, stack, 'variables.tf'), 'utf8');
  const required: string[] = [];
  for (const block of hcl.split(/^variable "/m).slice(1)) {
    const name = block.slice(0, block.indexOf('"'));
    const body = block.slice(0, block.search(/^}/m));
    if (!/^ {2}default\s*=/m.test(body)) required.push(name);
  }
  return required;
}

describe('stack variables', () => {
  for (const stack of STACKS) {
    const files = GLOBAL_STACKS.includes(stack)
      ? [{ label: 'global', keys: Object.keys(GLOBAL) }]
      : Object.values(ENV_FILES).map((env) => ({
          label: env.env,
          keys: [...Object.keys(GLOBAL), ...Object.keys(env)],
        }));
    for (const { label, keys } of files) {
      test(`${stack} (${label}): every required variable is set`, () => {
        const supplied = new Set([...keys, ...fromWrapper(stack)]);
        const missing = requiredVariables(stack).filter(
          (name) => !supplied.has(name)
        );
        expect(missing).toEqual([]);
      });
    }
  }
});
