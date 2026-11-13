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

// The Preview job checks out, installs and reads its secrets itself, side by
// side, instead of through the checkout, setup and secrets actions. What
// those guarantee still holds here.
test('the Preview installs frozen dependencies with no script, before any secret', () => {
  const steps = previewSteps();
  const start = steps[0]!.run ?? '';
  const lines = start.split('\n').map((line) => line.trim());
  const install = lines.findIndex((line) => line.includes('bun install'));
  const secrets = lines.indexOf('bun run apps/preview-ts/scripts/ci.ts run');
  expect(lines[install]).toEndWith(
    'bun install --frozen-lockfile --ignore-scripts'
  );
  // The command that reads the secrets starts after the install has ended.
  expect(lines.indexOf('wait "$installing"')).toBeGreaterThan(install);
  expect(secrets).toBeGreaterThan(lines.indexOf('wait "$installing"'));
  // No action runs in the job, so none is handed its token; the checkout
  // never has a credential to leave behind.
  expect(steps.filter((step) => step.uses !== undefined)).toEqual([]);
  expect(start).not.toMatch(/token|extraheader/i);
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
    'echo "$MISE_SHA256  $BOOT/mise.tar.zst" | sha256sum --check --quiet'
  );
  // Named tools only: each at the version mise.toml pins.
  expect(start.run).toContain('mise install bun\n');
  expect(start.run).toContain('mise install node &\n');
});

test('the bundle is built from everything it reads and nothing a deploy decides', () => {
  const tasks = readTurboTasks(root);
  // Every Preview command starts from the one cached bundle.
  for (const task of ['build', 'deploy', 'main'])
    expect(tasks[`//#task:preview:${task}`]?.dependsOn).toEqual([
      '@apps/harness-ts#build',
    ]);
  const build = tasks['@apps/harness-ts#build']!;
  expect(build.cache).not.toBe(false);
  expect(build.outputs).toEqual(['dist/**']);
  // The install generates nothing, so the build declares what it reads: its
  // own sources and every package's below it, what its Vite config loads,
  // and the derived files.
  expect(build.dependsOn).toEqual([
    'src',
    '@pkgs/sql-client-sqlite-web-server-ts#src',
    '@pkgs/vite-workspace-resolver-server-ts#src',
    '//#task:i18n:compile',
    '//#task:tokens:generate',
    '//#task:sounds:generate',
    '@pkgs/object-store-s3-server-ts#generate:browser',
  ]);
  // A restored bundle is right for any commit and any address only because
  // it names neither: both are read where it runs.
  const config = readFileSync(
    join(root, 'apps/harness-ts/vite.config.mts'),
    'utf8'
  );
  expect(config).toContain(
    "'import.meta.env.VITE_API_URL': 'globalThis.location.origin'"
  );
  expect(config).toContain(
    "'import.meta.env.VITE_COMMIT_HASH': 'globalThis.__BUILD__?.commit'"
  );
  expect(config).toContain(
    "'import.meta.env.VITE_COMMIT_DATE': 'globalThis.__BUILD__?.date'"
  );
});
