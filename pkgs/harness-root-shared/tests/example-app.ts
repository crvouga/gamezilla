/**
 * The one example app every `@pkgs/harness-root-shared` test drives (README.md
 * § "One example app per package"): a counter and a small key-value store
 * shared by two clients. It uses every capability the framework offers —
 * sampled and guarded actions, a pool-excluded action that fails, a
 * property, and JSON, HTML and PNG snapshots — so a test that needs a
 * variation configures it (extra `properties`) instead of forking it.
 */

import { defineAction } from '@pkgs/harness-root-shared/define-action';
import { defineProperty } from '@pkgs/harness-root-shared/define-property';
import { defineRuntime } from '@pkgs/harness-root-shared/define-runtime';
import { defineSnapshot } from '@pkgs/harness-root-shared/define-snapshot';
import type { System } from '@pkgs/harness-root-shared/define-system';
import { defineSystem } from '@pkgs/harness-root-shared/define-system';
import type { CatalogProperty } from '@pkgs/harness-root-shared/effect';
import { virtualTimeRuntime } from '@pkgs/harness-root-shared/virtual-time-runtime';

export type ExampleApp = {
  n: number;
  values: Record<string, string>;
  readonly clients: readonly string[];
};

/** Four bytes of a PNG header: the `screen` snapshot's whole image. */
export const EXAMPLE_PNG = new Uint8Array([137, 80, 78, 71]);

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

/** Always throws; kept out of random walks, applied only on purpose. */
export const boom = defineAction({
  name: 'boom',
  pool: false,
  describe: (who: string) => `explode ${who}`,
  act: (_s: ExampleApp, _who: string) => {
    throw new Error('kaboom');
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
    create: (): ExampleApp => ({ n: 0, values: {}, clients: ['alice', 'bob'] }),
    runtimes: [
      defineRuntime({
        default: true,
        name: 'virtual',
        create: () => virtualTimeRuntime(),
      }),
    ],
    actions: [inc, dec, put, boom],
    properties: [nonNegative, ...(options.properties ?? [])],
    snapshots: [
      defineSnapshot({
        name: 'store',
        capture: (s: ExampleApp) => ({ ...s.values }),
      }),
      defineSnapshot({
        name: 'html',
        media: 'html',
        capture: (s: ExampleApp) =>
          Object.fromEntries(
            s.clients.map((id) => [
              id,
              `<html><body>${id}:${s.values['x'] ?? ''}</body></html>`,
            ])
          ),
      }),
      defineSnapshot({
        name: 'screen',
        media: 'png',
        capture: () => EXAMPLE_PNG,
      }),
    ],
  });
}
