import { expect, test } from 'bun:test';
import { loadPreviewApplication } from '@pkgs/workspace-preview-client-ts/session';

const ORIGIN = 'https://efforts-essentially-rules-treasury.trycloudflare.com';

// regression: preview-assets-before-session-check
test('fonts, sounds and SQLite workers do not start until the preview session is usable', async () => {
  const ready = Promise.withResolvers<Response>();
  let loaded = false;
  const pending = loadPreviewApplication({
    origin: ORIGIN,
    http: {
      fetch: (input, init) => {
        expect(input).toBe(`${ORIGIN}/api/health`);
        expect(init).toMatchObject({
          credentials: 'same-origin',
          redirect: 'manual',
          cache: 'no-store',
        });
        return ready.promise;
      },
    },
    load: async () => {
      loaded = true;
      return 'application';
    },
  });
  expect(loaded).toBe(false);
  ready.resolve(Response.json({ status: 'ok' }));
  expect(await pending).toBe('application');
  expect(loaded).toBe(true);
});

// regression: preview-assets-before-session-check
test('login redirects and login HTML reach startup recovery before app modules run', async () => {
  for (const response of [
    { type: 'opaqueredirect', ok: false } as Response,
    new Response('<html>Sign in</html>', {
      headers: { 'content-type': 'text/html' },
    }),
    new Response('Unauthorized', { status: 401 }),
  ]) {
    let loaded = false;
    await expect(
      loadPreviewApplication({
        origin: ORIGIN,
        http: { fetch: async () => response },
        load: async () => {
          loaded = true;
        },
      })
    ).rejects.toThrow('email sign-in');
    expect(loaded).toBe(false);
  }
});

test('production and local offline startup do not acquire a preview dependency', async () => {
  for (const origin of [null, 'http://127.0.0.1:5240']) {
    expect(
      await loadPreviewApplication({
        origin,
        http: {
          fetch: async () => {
            throw new Error('Must not probe');
          },
        },
        load: async () => 'application',
      })
    ).toBe('application');
  }
});
