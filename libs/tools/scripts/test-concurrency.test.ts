import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { testConcurrency } from '@pkgs/os-server/test-concurrency';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import { $ } from 'bun';
import fc from 'fast-check';
import { localCheckEnv } from './local-check-queue';

// regression: local-check-product-contract-concurrency
test('product model and rendering contracts respect local test concurrency', async () => {
  const manifest = JSON.parse(
    readFileSync(
      join(import.meta.dirname, '../../../apps/product/package.json'),
      'utf8'
    )
  ) as {
    scripts: Record<string, string>;
  };
  const parts = Object.entries(manifest.scripts).filter(([name]) =>
    /^test:contract:\d+$/.test(name)
  );
  expect(parts.length).toBeGreaterThan(0);
  const commands = [
    ...parts.map(([, script]) => script),
    manifest.scripts['test:contract:render']!,
  ];
  for (const [, script] of parts) {
    expect(script).toContain('tests/quint/model-checks.test.ts');
    expect(script).not.toContain('ui-quality-render');
  }
  expect(commands.at(-1)).toContain('tests/ui-quality-render.contract.test.ts');
  for (const command of commands) {
    expect(command).toContain(
      '--max-concurrency=$(bun ../../pkgs/os-server/src/test-concurrency.ts 2)'
    );
  }
  const cli = join(
    import.meta.dirname,
    '../../../pkgs/os-server/src/test-concurrency.ts'
  );
  const local = await $`printf %s $(bun ${cli} 2)`
    .env(localCheckEnv({}))
    .quiet();
  expect(local.stdout.toString()).toBe('1');
  expect(testConcurrency({}, 2)).toBe(2);
  expect(testConcurrency({ CI: 'true' }, 2)).toBe(2);
  for (const path of ['apps/product', 'pkgs/quint-server']) {
    const manifest = JSON.parse(
      readFileSync(
        join(import.meta.dirname, '../../..', path, 'package.json'),
        'utf8'
      )
    ) as {
      scripts: Record<string, string>;
    };
    expect(manifest.scripts['test']).toContain('test-concurrency.ts)');
  }
  expect(testConcurrency({})).toBe(20);
  expect(testConcurrency(localCheckEnv({}))).toBe(1);
});

test('explicit concurrency lowers but never raises the existing test ceilings', () => {
  assertProperty(
    'explicit-test-concurrency',
    fc.property(fc.integer({ min: 1, max: 100 }), (count) => {
      expect(testConcurrency({ CHECK_TEST_CONCURRENCY: String(count) })).toBe(
        Math.min(20, count)
      );
      expect(
        testConcurrency({ CHECK_TEST_CONCURRENCY: String(count) }, 2)
      ).toBe(Math.min(2, count));
    })
  );
  for (const value of ['0', '-1', '1.5', 'Infinity', 'bad'])
    expect(() => testConcurrency({ CHECK_TEST_CONCURRENCY: value })).toThrow(
      'positive integer'
    );
});
