import type { Hono } from 'hono';
import type { PatchesDb } from '@gamezilla/patch-db/interface';
import { handleAuthClaim } from '../auth/claim-handler';

export function registerAuthClaim(
  app: Hono,
  db: PatchesDb,
  googleClientId: string | undefined
): void {
  app.post('/auth/claim', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Invalid JSON body' }, 400);
    }
    const authOpts =
      googleClientId !== undefined && googleClientId !== ''
        ? { googleClientId }
        : {};
    return handleAuthClaim(db, body, authOpts);
  });
}
