import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_FILES } from '@libs/infra-shared-ts/envs';
import {
  CREDENTIAL_ENV,
  varFiles as filesOf,
  GLOBAL_STACKS,
  STACKS,
  type Stack,
  type Target,
} from '@libs/infra-shared-ts/tofu-command';
import { resolvedVarFiles } from '@libs/infra-shared-ts/tofu-var-files';

/**
 * `tofu validate` never sees variable values. A required variable no var
 * file sets fails at plan time, mid-deploy. A var-file key the stack does
 * not declare is only OpenTofu's "Value for undeclared variable" warning,
 * and the plan still exits 0. Both are pinned here, offline, against the
 * resolved files `scripts/tofu.ts` passes (global, then the env's or every
 * env's) and the `TF_VAR_*` the wrapper exports.
 */
const STACKS_DIR = join(
  import.meta.dirname,
  '../../infra-shared-ts/tofu/stacks'
);

type VariableBlock = {
  readonly name: string;
  readonly hasDefault: boolean;
};

/**
 * `TF_VAR_*` that `scripts/tofu.ts` / `tofu-command.ts` export: the stack's
 * credential mapping, plus the Infisical token `tofu.ts` mints itself.
 */
function fromWrapper(stack: Stack): Set<string> {
  const names = Object.keys(CREDENTIAL_ENV[stack])
    .filter((key) => key.startsWith('TF_VAR_'))
    .map((key) => key.slice('TF_VAR_'.length));
  return new Set([...names, 'infisical_token']);
}

/** Root variable blocks, including ones that live outside `variables.tf`. */
function variableBlocks(stack: string): VariableBlock[] {
  const dir = join(STACKS_DIR, stack);
  const blocks: VariableBlock[] = [];
  for (const file of readdirSync(dir)) {
    if (!file.endsWith('.tf')) continue;
    const hcl = readFileSync(join(dir, file), 'utf8');
    for (const block of hcl.split(/^variable "/m).slice(1)) {
      const name = block.slice(0, block.indexOf('"'));
      const bodyEnd = block.search(/^}/m);
      const body = bodyEnd === -1 ? block : block.slice(0, bodyEnd);
      blocks.push({
        name,
        hasDefault: /^ {2}default\s*=/m.test(body),
      });
    }
  }
  return blocks;
}

function requiredVariables(stack: string): string[] {
  return variableBlocks(stack)
    .filter((block) => !block.hasDefault)
    .map((block) => block.name);
}

const RESOLVED = resolvedVarFiles();

function keysOf(file: string): string[] {
  const text = RESOLVED.get(file);
  if (text === undefined) throw new Error(`no resolved var file ${file}`);
  return Object.keys(JSON.parse(text) as object);
}

function varFiles(stack: Stack): { label: string; keys: readonly string[] }[] {
  const targets: Target[] = GLOBAL_STACKS.includes(stack)
    ? [{ stack, env: null }]
    : Object.keys(ENV_FILES).map((env) => ({ stack, env }));
  return targets.map((target) => ({
    label: target.env ?? 'global',
    keys: filesOf(target).flatMap(keysOf),
  }));
}

describe('stack variables', () => {
  for (const stack of STACKS) {
    for (const { label, keys } of varFiles(stack)) {
      test(`${stack} (${label}): every required variable is set`, () => {
        const supplied = new Set([...keys, ...fromWrapper(stack)]);
        const missing = requiredVariables(stack).filter(
          (name) => !supplied.has(name)
        );
        expect(missing).toEqual([]);
      });

      // regression: tofu-var-file-undeclared
      test(`${stack} (${label}): every var-file key is declared`, () => {
        const declared = new Set(
          variableBlocks(stack).map((block) => block.name)
        );
        const undeclared = keys.filter((name) => !declared.has(name)).sort();
        expect(undeclared).toEqual([]);
      });
    }
  }
});
