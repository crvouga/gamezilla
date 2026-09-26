// @io-wall-ok — live probe: plans both stacks against the deployed environment.
/**
 * Live infrastructure equals `libs/infra/tofu` for this `SECRETS_ENV`: both
 * stacks plan to no changes and pass the stateful policy. A console edit, a
 * resource deleted by hand or a half-finished deploy turns this red.
 */
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const SCRIPT = join(import.meta.dirname, '../scripts/tofu.ts');

describe('infrastructure matches libs/infra/tofu', () => {
  for (const stack of ['foundation', 'edge'] as const) {
    test(`${stack} has no drift`, () => {
      const result = Bun.spawnSync(
        ['bun', 'run', SCRIPT, 'drift', '--stack', stack],
        {
          env: process.env,
          stdout: 'pipe',
          stderr: 'pipe',
        }
      );
      const output = `${result.stdout.toString()}${result.stderr.toString()}`;
      expect({ exitCode: result.exitCode, output }).toMatchObject({
        exitCode: 0,
      });
    }, 180_000);
  }
});
