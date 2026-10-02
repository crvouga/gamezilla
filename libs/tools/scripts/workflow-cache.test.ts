import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '../../..');

// regression: check-cache-write-only-override
test('Check enforces read/write after secrets injection', () => {
  const workflow = readFileSync(
    join(root, '.depot/workflows/check.yml'),
    'utf8'
  );
  expect(workflow).toContain(
    'secrets-run.ts -- env TURBO_CACHE=local:rw,remote:rw TURBO_CONCURRENCY=12 bun run'
  );
});

// regression: depot-api-dependency-cache-ref
test('setup does not use ref-dependent dependency cache actions', () => {
  const setup = readFileSync(
    join(root, '.depot/actions/setup/action.yml'),
    'utf8'
  );
  expect(setup).not.toMatch(/uses: actions\/cache/);
  expect(setup).toContain('bun install --frozen-lockfile');
  expect(setup).toContain('uses: jdx/mise-action@v4');
});

// regression: turbo-build-unhashed-inputs
test('build hashes its toolchain, shared compiler configs and output-affecting env', () => {
  const turbo = JSON.parse(readFileSync(join(root, 'turbo.json'), 'utf8')) as {
    globalDependencies: string[];
    tasks: {
      build: { env: string[]; inputs: string[] };
      '@apps/product#check:offline-shell': {
        inputs: string[];
        dependsOn: string[];
      };
    };
  };
  expect(turbo.globalDependencies).toContain('mise.toml');
  // Vite embeds the entire public env object for import.meta.env reads.
  for (const name of ['VITE_*', 'ANALYZE']) {
    expect(turbo.tasks.build.env).toContain(name);
  }
  for (const file of [
    'package.json',
    'lingui.config.ts',
    'lingui.solid.config.ts',
  ]) {
    expect(turbo.tasks.build.inputs).toContain(`$TURBO_ROOT$/${file}`);
  }
  for (const input of ['**/*.po', '**/*.mts', '.env.local']) {
    expect(turbo.tasks.build.inputs).toContain(input);
  }
  expect(turbo.tasks['@apps/product#check:offline-shell'].dependsOn).toContain(
    '@apps/product#build'
  );
  expect(turbo.tasks['@apps/product#check:offline-shell'].inputs).not.toContain(
    'dist/**'
  );
});
