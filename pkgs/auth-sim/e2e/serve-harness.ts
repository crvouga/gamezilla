// @io-wall-ok — auth OAuth e2e harness server

/**
 * Two processes' worth of surface on one machine: the auth app on :4178 and
 * the simulated Google provider on its own port, with its own state. The
 * harness page drives the real popup flow between them.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthSqliteDatabaseMigration } from '@pkgs/auth/server/auth-database-migration';
import { createAuthApp } from '@pkgs/auth/server/create-auth-app';
import { idpEndpoints } from '@pkgs/idp-google-sim/shared';
import { startGoogleIdpServer } from '@pkgs/idp-google-sim/start-server';
import { createNoopLogger } from '@pkgs/logger';
import { virtualTimeRuntime } from '@pkgs/sim';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client-sqlite/impl-sqlite-mem';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 4178;
const API_ORIGIN = `http://127.0.0.1:${PORT}`;
const AUTH_SECRET = 'auth-system-secret-0123456789abcdef';
const CLIENT_ID = 'auth-e2e.apps.googleusercontent.com';
const CLIENT_SECRET = 'auth-e2e-secret';
const REDIRECT_URI = `${API_ORIGIN}/auth/callback/google`;

const idp = await startGoogleIdpServer({
  port: Number(process.env['IDP_PORT'] ?? 0),
  clients: [
    {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      redirectUris: [REDIRECT_URI],
      appName: 'Auth Harness',
    },
  ],
  accounts: [{ handle: 'alice' }, { handle: 'bob' }],
});

const session = await virtualTimeRuntime().open(1);
const sql = SqlClientImplSqliteMem.open({ seed: 1 });
await new AuthSqliteDatabaseMigration().migrate({
  sqlClient: sql,
  logger: createNoopLogger(),
});

const app = createAuthApp({
  getSql: () => sql,
  clock: session.ports.clock,
  createId: session.ports.createId,
  http: { fetch: (input, init) => fetch(input, init) },
  secret: AUTH_SECRET,
  baseURL: API_ORIGIN,
  trustedOrigins: [
    API_ORIGIN,
    `${API_ORIGIN}/oauth-callback`,
    'gamezilla://',
    'http://localhost:5173',
    'http://callback.test',
  ],
  providers: {
    google: {
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
      endpoints: idpEndpoints(idp.origin),
    },
  },
});

const authE2e = join(here, '../../auth/e2e/harness');
const html = readFileSync(join(authE2e, 'oauth-harness.html'), 'utf8');

const CALLBACK_HTML = `<!DOCTYPE html><html><body><script>
  const code = new URL(location.href).searchParams.get('code');
  if (window.opener && code) {
    window.opener.postMessage({ type: 'oauth-complete', code }, '*');
  }
  window.close();
</script></body></html>`;

Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/auth/')) return app.fetch(req);
    if (url.pathname === '/oauth-callback') {
      return new Response(CALLBACK_HTML, {
        headers: { 'content-type': 'text/html' },
      });
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(html, { headers: { 'content-type': 'text/html' } });
    }
    return new Response('not found', { status: 404 });
  },
});

process.stdout.write(`auth e2e harness ${API_ORIGIN} (idp ${idp.origin})\n`);
