/**
 * The one example app every `@pkgs/harness-report` test reports on
 * (README.md): a counter and a small
 * key-value store that Alice and Bob look at. It captures every snapshot
 * medium the report renders — JSON, text, HTML and PNG — and a test that
 * needs a report with no screens (a synthesized state frame) configures it with
 * `screens: false` instead of forking it.
 */
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import { defineRuntime } from '@pkgs/harness-root-shared-ts/define-runtime';
import { defineSnapshot } from '@pkgs/harness-root-shared-ts/define-snapshot';
import type { System } from '@pkgs/harness-root-shared-ts/define-system';
import { defineSystem } from '@pkgs/harness-root-shared-ts/define-system';
import { virtualTimeRuntime } from '@pkgs/harness-root-shared-ts/virtual-time-runtime';

export type ExampleApp = { n: number; values: Record<string, string> };

export const put = defineAction({
  name: 'put',
  act: (s: ExampleApp, key: string, value: string) => {
    s.values[key] = value;
  },
});

export const bump = defineAction({
  name: 'bump',
  act: (s: ExampleApp) => {
    s.n += 1;
  },
});

const documents = [
  defineSnapshot({
    name: 'state',
    media: 'json',
    capture: (s: ExampleApp) => ({ n: s.n, values: { ...s.values } }),
  }),
  defineSnapshot({
    name: 'log',
    media: 'text',
    capture: (s: ExampleApp) => `n=${s.n}`,
  }),
  defineSnapshot({
    name: 'clients',
    media: 'json',
    capture: (s: ExampleApp) => ({
      alice: { n: s.n },
      bob: { n: s.n * 2 },
    }),
  }),
];

const screens = [
  defineSnapshot({
    name: 'html',
    media: 'html',
    capture: (s: ExampleApp) => ({
      // Solid renders literal `<!---->` markers, and product markup can
      // carry a `</script>`; both must survive the inline data script.
      alice: `<html><head></head><body>alice sees <!---->${s.values['x'] ?? ''}<!----><script>x</script></body></html>`,
    }),
  }),
  defineSnapshot({
    name: 'shot',
    media: 'png',
    capture: () => new Uint8Array([137, 80, 78, 71]),
  }),
];

export function exampleApp(
  options: { readonly screens?: boolean } = {}
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
    actions: [put, bump],
    snapshots: [...documents, ...(options.screens === false ? [] : screens)],
  });
}
