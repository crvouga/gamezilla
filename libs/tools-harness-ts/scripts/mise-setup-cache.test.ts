import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// regression: mise-cache-stall-consumes-verification-budget
test('fresh runners install pinned tools without the stalled tool archive', () => {
  // Run 41039477627 shard 50 spent 20m41s in setup: a 952,504,713-byte
  // tool archive stalled and failed authentication; direct install took 25s.
  const setup = Bun.YAML.parse(
    readFileSync(
      join(import.meta.dirname, '../../../.github/actions/setup/action.yml'),
      'utf8'
    )
  ) as {
    runs: {
      steps: {
        uses?: string;
        if?: string;
        'continue-on-error'?: boolean;
        with?: Record<string, unknown>;
      }[];
    };
  };
  const installs = setup.runs.steps.filter((step) =>
    step.uses?.startsWith('jdx/mise-action@')
  );
  expect(installs).toHaveLength(1);
  const install = installs[0]!;
  expect(install.uses).toMatch(/^jdx\/mise-action@[a-f0-9]{40}$/);
  expect(install.if).toBeUndefined();
  expect(install['continue-on-error']).toBeUndefined();
  expect(install.with?.['install']).not.toBe(false);
  expect(install.with?.['install_args']).toBe(
    "${{ inputs.tools || '--include-lazy' }}"
  );
  expect(install.with?.['cache']).toBe(false);
});
