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
        name?: string;
        run?: string;
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
  // regression: mise-release-download-504
  // A GitHub release-download outage (Verify PR run 42566398011) falls back to
  // main's toolchain snapshot; a miss still fails the job.
  expect(install['continue-on-error']).toBe(true);
  const fallback = setup.runs.steps.find(
    (step) =>
      step.uses?.startsWith('actions/cache/restore@') &&
      step.if === "steps.mise.outcome == 'failure'"
  );
  expect(fallback?.with?.['fail-on-cache-miss']).toBe(true);
  expect(fallback?.with?.['path']).toBe('~/.local/share/mise');
  // regression: mise-cached-env-paths-unsupported
  // Run 43536067972 shard 7 restored all 19 tools, then the cached mise
  // rejected `env --paths`, preventing dependency installation and verification.
  const activate = setup.runs.steps.find(
    (step) => step.name === 'Activate the restored toolchain'
  );
  expect(activate?.run).toContain(
    `mise env --json | jq -r '.PATH | split(":")[]' >> "$GITHUB_PATH"`
  );
  expect(activate?.run).not.toContain('mise env --paths');
  expect(install.with?.['install']).not.toBe(false);
  expect(install.with?.['install_args']).toBe(
    "${{ inputs.tools || '--include-lazy' }}"
  );
  expect(install.with?.['cache']).toBe(false);
});
