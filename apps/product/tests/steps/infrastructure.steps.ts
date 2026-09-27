// @io-wall-ok — live health: plans both OpenTofu stacks against the environment.
/** `specs/health/infrastructure.feature`. */

import { expect } from 'bun:test';
import { join } from 'node:path';
import { Then } from './define';

const TOFU_SCRIPT = join(
  import.meta.dir,
  '../../../../libs/infra/scripts/tofu.ts'
);
const STACKS = ['foundation', 'edge'] as const;

Then(
  'the {string} stack plans no changes and passes the stateful policy',
  (_w, stack: string) => {
    expect(STACKS).toContain(stack as (typeof STACKS)[number]);
    const result = Bun.spawnSync(
      ['bun', 'run', TOFU_SCRIPT, 'drift', '--stack', stack],
      { env: process.env, stdout: 'pipe', stderr: 'pipe' }
    );
    const output = `${result.stdout.toString()}${result.stderr.toString()}`;
    expect({ exitCode: result.exitCode, output }).toMatchObject({
      exitCode: 0,
    });
  }
);
