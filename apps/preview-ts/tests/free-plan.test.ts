import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { billableSettings, FREE_PLAN, freePlanCheck } from '../src/free-plan';

const APPS = join(import.meta.dirname, '../..');

function committed(app: string): Record<string, unknown> {
  return Bun.TOML.parse(
    readFileSync(join(APPS, app, 'wrangler.toml'), 'utf8')
  ) as Record<string, unknown>;
}

test('the Preview and Storybook Workers declare static files and nothing that could be billed', () => {
  expect(billableSettings(committed('preview-ts'))).toEqual([]);
  expect(billableSettings(committed('storybook-ts'))).toEqual([]);
});

test('a Worker script, a binding or a variable is more than static files', () => {
  const free = committed('preview-ts');
  expect(billableSettings({ ...free, main: 'src/worker.ts' })).toEqual([
    'main',
  ]);
  expect(
    billableSettings({
      ...free,
      durable_objects: { bindings: [] },
      kv_namespaces: [],
      vars: { A: '1' },
    })
  ).toEqual(['durable_objects', 'kv_namespaces', 'vars']);
  expect(
    billableSettings({
      ...free,
      assets: { directory: 'dist', binding: 'ASSETS', run_worker_first: true },
    })
  ).toEqual(['assets.binding', 'assets.run_worker_first']);
  expect(billableSettings({ ...free, previews: { vars: { A: '1' } } })).toEqual(
    ['previews.vars']
  );
});

test('any setting the free static site does not declare today is refused', () => {
  const free = committed('preview-ts');
  assertProperty(
    'an unknown setting is billable until allowed',
    fc.property(
      fc.stringMatching(/^[a-z][a-z_]{0,20}$/).filter((key) => !(key in free)),
      (key) => {
        expect(billableSettings({ ...free, [key]: true })).toEqual([key]);
      }
    )
  );
});

test('a bundle fits the free plan up to its file count and file size, and no further', () => {
  const file = (path: string, bytes: number) => ({ path, bytes });
  expect(freePlanCheck([]).ok).toBe(true);
  expect(
    freePlanCheck([file('index.html', 1), file('a.js', FREE_PLAN.fileBytes)])
  ).toEqual({
    name: 'free plan',
    ok: true,
    detail: '2 files, the largest 25.0 MiB',
  });
  const tooLarge = freePlanCheck([
    file('index.html', 1),
    file('assets/big.wasm', FREE_PLAN.fileBytes + 1),
  ]);
  expect(tooLarge.ok).toBe(false);
  expect(tooLarge.detail).toContain('assets/big.wasm');
  const atLimit = Array.from({ length: FREE_PLAN.filesPerUpload }, (_, i) =>
    file(`${String(i)}.js`, 1)
  );
  expect(freePlanCheck(atLimit).ok).toBe(true);
  const tooMany = freePlanCheck([...atLimit, file('one-more.js', 1)]);
  expect(tooMany.ok).toBe(false);
  expect(tooMany.detail).toContain(String(FREE_PLAN.filesPerUpload + 1));
});
