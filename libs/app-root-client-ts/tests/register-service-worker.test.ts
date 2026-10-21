import { expect, test } from 'bun:test';
import { runInNewContext } from 'node:vm';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

async function productionRegistration(production: boolean): Promise<string> {
  const result = await Bun.build({
    entrypoints: [
      Bun.resolveSync(
        '@libs/app-root-client-ts/register-service-worker',
        import.meta.dir
      ),
    ],
    target: 'browser',
    format: 'cjs',
    define: { 'import.meta.env.PROD': String(production) },
    plugins: [
      {
        name: 'workbox-port',
        setup(builder) {
          builder.onResolve({ filter: /^workbox-window$/ }, () => ({
            path: 'workbox',
            namespace: 'test',
          }));
          builder.onLoad({ filter: /.*/, namespace: 'test' }, () => ({
            contents: `export class Workbox {
            addEventListener() {}
            removeEventListener() {}
            register() { calls.push('register'); return Promise.resolve(); }
          }`,
            loader: 'js',
          }));
        },
      },
    ],
  });
  expect(result.success).toBe(true);
  return await result.outputs[0]!.text();
}

function register(source: string, hostname: string): string[] {
  const calls: string[] = [];
  const module = { exports: {} as Record<string, (args: unknown) => unknown> };
  runInNewContext(source, {
    module,
    exports: module.exports,
    window: { location: { hostname } },
    navigator: { serviceWorker: {} },
    calls,
  });
  module.exports['registerServiceWorker']!({
    onUpdateAvailable() {},
    onRegisterError() {},
  });
  return calls;
}

// regression: production-preview-no-service-worker
test('a production bundle installs its offline shell on localhost', async () => {
  expect(register(await productionRegistration(true), '127.0.0.1')).toEqual([
    'register',
  ]);
});

test('production offline registration is independent of the serving hostname', async () => {
  const source = await productionRegistration(true);
  assertProperty(
    'production offline shell on every origin',
    fc.property(
      fc.constantFrom('localhost', '127.0.0.1', '[::1]', 'app.example.test'),
      (hostname) => expect(register(source, hostname)).toEqual(['register'])
    )
  );
  expect(
    register(await productionRegistration(false), 'app.example.test')
  ).toEqual([]);
});
