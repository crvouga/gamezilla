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
  expect(lines[install]).toEndWith(
    'bun install --frozen-lockfile --ignore-scripts'
  );
  // The command that reads the secrets starts after the install has ended.
  const secrets = lines.findIndex((line) =>
    line.endsWith('bun run apps/preview-ts/scripts/ci.ts run')
  );
  expect(lines.indexOf('wait "$installing"')).toBeGreaterThan(install);
  expect(secrets).toBeGreaterThan(lines.indexOf('wait "$installing"'));
  // No action runs in the job, so none is handed its token; the checkout
  // never has a credential to leave behind; and nothing the checkout wrote
  // names a tool for a later step (no `GITHUB_PATH`, no `GITHUB_ENV`).
  expect(steps.filter((step) => step.uses !== undefined)).toEqual([]);
  expect(start).not.toMatch(/token|extraheader/i);
  for (const step of steps) expect(step.run).not.toMatch(/GITHUB_(PATH|ENV)/);
});

// GitHub runs the workflow of the pull request's merge with main, and the
// step runs a command of the commit it checks out. A head that has another
// version of the workflow would be handed a command it does not have (the
// Preview of every open pull request failed when the command was renamed).
test('a head with another Preview workflow than the one running is built from the merge', () => {
  const start = previewSteps()[0]!.run ?? '';
  const lines = start.split('\n').map((line) => line.trim());
  const compared = lines.indexOf(
    'if ! cmp -s "$BOOT/head.yml" "$BOOT/merge.yml"; then'
  );
  expect(compared).toBeGreaterThan(-1);
  expect(start).toContain('"$raw/$PREVIEW_SHA/.github/workflows/preview.yml"');
  expect(start).toContain('"$raw/$GITHUB_SHA/.github/workflows/preview.yml"');
  const merged = lines.indexOf('PREVIEW_SHA="$GITHUB_SHA"');
  expect(merged).toBeGreaterThan(compared);
  // regression: preview-merge-stamp. The Preview stays the head's: the
  // page is stamped with the head, which is the commit the deploy waits for.
  expect(lines[merged - 1]).toBe('export PREVIEW_COMMIT="$PREVIEW_SHA"');
  const command = readFileSync(
    join(root, 'apps/preview-ts/scripts/preview.ts'),
    'utf8'
  );
  expect(command).toContain(
    "sha: envOf('PREVIEW_COMMIT') ?? git(['rev-parse', 'HEAD']),"
  );
  // Decided before anything reads the commit: the checkout and the tools.
  expect(lines.indexOf('checkout &')).toBeGreaterThan(merged);
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
      '//#task:i18n:compile',
    ]);
  const build = tasks['@apps/harness-ts#build']!;
  expect(build.cache).not.toBe(false);
  expect(build.outputs).toEqual(['dist/**']);
  // The install generates nothing, so the build declares what it reads: its
  // own sources and every package's below it, what its Vite config loads,
  // and the derived files. The messages are not among them: they compile
  // beside the bundle, which loads them from the page.
  expect(build.dependsOn).toEqual([
    'src',
    '@pkgs/sql-client-sqlite-web-server-ts#src',
    '@pkgs/vite-workspace-resolver-server-ts#src',
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
