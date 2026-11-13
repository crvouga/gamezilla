// @io-wall-ok — inspect the Preview workflow's own bootstrap.
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readTurboTasks } from './turbo-config';

const root = join(import.meta.dirname, '../../..');

type Step = {
  name?: string;
  uses?: string;
  run?: string;
  env?: Record<string, string | number>;
};

function previewSteps(): readonly Step[] {
  const workflow = Bun.YAML.parse(
    readFileSync(join(root, '.github/workflows/preview.yml'), 'utf8')
  ) as { jobs: { preview: { steps: Step[] } } };
  return workflow.jobs.preview.steps;
}

// The Preview job starts its checkout, tools and install itself, side by
// side, instead of through the setup action. What that action guarantees
// still holds here.
test('the Preview installs frozen dependencies with no script, before any secret', () => {
  const steps = previewSteps();
  const start = steps.findIndex((step) =>
    step.run?.includes('bun install --frozen-lockfile --ignore-scripts')
  );
  const secrets = steps.findIndex(
    (step) => step.uses === './.github/actions/secrets-auth'
  );
  expect(start).toBe(0);
  expect(secrets).toBeGreaterThan(start);
  // Every install in the job is that one.
  for (const step of steps)
    for (const line of (step.run ?? '').split('\n'))
      if (line.includes('bun install'))
        expect(line.trim()).toBe(
          'bun install --frozen-lockfile --ignore-scripts'
        );
  // The checkout leaves no credential behind: it never had one.
  expect(steps.some((step) => step.uses?.startsWith('actions/checkout'))).toBe(
    false
  );
  expect(steps[start]!.run).not.toMatch(/token|GH_TOKEN|extraheader/i);
});

test('the Preview installs the tools mise.toml pins, with the mise the setup action pins, held to a checksum', () => {
  const start = previewSteps()[0]!;
  const setup = readFileSync(
    join(root, '.github/actions/setup/action.yml'),
    'utf8'
  );
  expect(String(start.env?.['MISE_VERSION'])).toBe(
    /^\s+version: (\S+)$/m.exec(setup)?.[1] ?? ''
  );
  expect(String(start.env?.['MISE_SHA256'])).toMatch(/^[0-9a-f]{64}$/);
  expect(start.run).toContain(
    'echo "$MISE_SHA256  $BOOT/mise" | sha256sum --check --quiet'
  );
  expect(start.run).toContain('"$BOOT/mise" install bun node');
});

test('the Preview build generates the derived files a bundle reads', () => {
  // The install generates nothing, so the build declares what it needs.
  const tasks = readTurboTasks(root);
  for (const task of ['build', 'deploy', 'main'])
    expect(tasks[`//#task:preview:${task}`]?.dependsOn).toEqual([
      '//#task:i18n:compile',
      '//#task:tokens:generate',
      '//#task:sounds:generate',
      '@pkgs/object-store-s3-server-ts#generate:browser',
    ]);
});
