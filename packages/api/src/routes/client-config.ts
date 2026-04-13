import { Hono } from 'hono';

/**
 * GET `/client-config` — public Google Web client ID for id_token audience checks.
 * @see https://hono.dev/docs/guides/best-practices — mount sub-apps with `app.route()`.
 */
export function createClientConfigApp(googleClientId: string | undefined) {
  return new Hono().get('/client-config', (c) => {
    const googleWebClientId =
      googleClientId !== undefined && googleClientId !== ''
        ? googleClientId
        : null;
    return c.json({ googleWebClientId }, 200);
  });
}
