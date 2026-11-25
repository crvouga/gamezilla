/**
 * The one example app every `@pkgs/harness-root-shared-ts` test drives (README.md
 * § "One example app per package"): a counter and a small key-value store
 * store. It uses every capability the framework offers —
 * sampled and guarded actions and a property — so a test that needs a
 * variation configures it (extra `properties`) instead of forking it.
 */

import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineProperty } from '@pkgs/harness-root-shared-ts/define-property';
import { defineRuntime } from '@pkgs/harness-root-shared-ts/define-runtime';
import type { System } from '@pkgs/harness-root-shared-ts/define-system';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import type { CatalogProperty } from '@pkgs/harness-root-shared-ts/effect';
import { virtualTimeRuntime } from '@pkgs/harness-root-shared-ts/virtual-time-runtime';

export type ExampleApp = {
  n: number;
  values: Record<string, string>;
};

export const inc = defineAction({
  name: 'inc',
  weight: 3,
  sample: () => (rng) => 1 + Math.floor(rng.next() * 3),
  act: (s: ExampleApp, by: number) => {
    s.n += by;
  },
});

export const dec = defineAction({
  name: 'dec',
  enabled: (s: ExampleApp) => s.n > 0,
  weight: 2,
  sample: (s: ExampleApp) => (rng) =>
    1 + Math.floor(rng.next() * Math.min(3, s.n)),
  act: (s: ExampleApp, by: number) => {
    s.n -= by;
  },
});

export const put = defineAction({
  name: 'put',
  sample:
    () =>
    (rng): [string, string] => [
      rng.next() < 0.5 ? 'x' : 'y',
      `v${String(rng.next())}`,
    ],
  act: (s: ExampleApp, key: string, value: string) => {
    s.values[key] = value;
  },
});

const nonNegative = defineProperty({
  name: 'nonNegative',
  check: (s: ExampleApp) => {
    if (s.n < 0) throw new Error(`n ${String(s.n)} < 0`);
  },
});

export function exampleApp(
  options: { readonly properties?: readonly CatalogProperty<ExampleApp>[] } = {}
): System<ExampleApp> {
  return defineSystem({
    name: 'example-app',
    create: (): ExampleApp => ({ n: 0, values: {} }),
    runtimes: [
      defineRuntime({
        default: true,
        name: 'virtual',
        create: () => virtualTimeRuntime(),
      }),
    ],
    actions: [inc, dec, put],
    properties: [nonNegative, ...(options.properties ?? [])],
  });
}
