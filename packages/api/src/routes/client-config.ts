import type { Hono } from 'hono';

export function registerClientConfig(
  app: Hono,
  googleClientId: string | undefined
): void {
  app.get('/client-config', (c) => {
    const googleWebClientId =
      googleClientId !== undefined && googleClientId !== ''
        ? googleClientId
        : null;
    return c.json({ googleWebClientId });
  });
}
