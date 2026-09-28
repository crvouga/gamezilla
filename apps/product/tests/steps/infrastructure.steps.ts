// @io-wall-ok — live health: plans both OpenTofu stacks against the environment.
/** `specs/health/declared-environment.feature`. */

import { expect } from 'bun:test';
import { join } from 'node:path';
import { Then } from './define';

const TOFU_SCRIPT = join(
  import.meta.dir,
  '../../../../libs/infra/scripts/tofu.ts'
);
const STACKS = ['foundation', 'edge'] as const;

/** Every stack plans no changes and passes the stateful policy. */
Then('this environment is exactly as the team planned it', () => {
  for (const stack of STACKS) {
    const result = Bun.spawnSync(
      ['bun', 'run', TOFU_SCRIPT, 'drift', '--stack', stack],
      { env: process.env, stdout: 'pipe', stderr: 'pipe' }
    );
    const output = `${result.stdout.toString()}${result.stderr.toString()}`;
    expect({ stack, exitCode: result.exitCode, output }).toMatchObject({
      stack,
      exitCode: 0,
    });
  }
});
