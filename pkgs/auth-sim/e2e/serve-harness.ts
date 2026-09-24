// @io-wall-ok — auth OAuth e2e harness server

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthSqliteDatabaseMigration } from '@pkgs/auth/server/auth-database-migration';
import { createAuthApp } from '@pkgs/auth/server/create-auth-app';
import { createNoopLogger } from '@pkgs/logger';
import { virtualTimeRuntime } from '@pkgs/sim';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite/impl-mockingbird-sqlite';
import { createMockingbirdGoogle } from '../src/mockingbird-google';
import { AUTH_SYSTEM_GOOGLE_CLIENT, AUTH_SYSTEM_SUBJECTS } from '../src/types';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 4178;
const API_ORIGIN = `http://127.0.0.1:${PORT}`;
const AUTH_SECRET = 'auth-system-secret-0123456789abcdef';

const session = await virtualTimeRuntime().open(1);
const google = createMockingbirdGoogle({
  ...AUTH_SYSTEM_GOOGLE_CLIENT,
  clock: session.ports.clock,
  redirectUri: `${API_ORIGIN}/auth/callback/google`,
  subjects: AUTH_SYSTEM_SUBJECTS,
});
const sql = SqlClientImplMockingbirdSqlite.open({ seed: 1 });
await new AuthSqliteDatabaseMigration().migrate({
  sqlClient: sql,
  logger: createNoopLogger(),
});

const app = createAuthApp({
  getSql: () => sql,
  clock: session.ports.clock,
  createId: session.ports.createId,
  http: google.http,
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
    google: AUTH_SYSTEM_GOOGLE_CLIENT,
    dev: { enabled: true },
  },
});

const authE2e = join(here, '../../auth/e2e/harness');
const html = readFileSync(join(authE2e, 'oauth-harness.html'), 'utf8');

Bun.serve({
  port: PORT,
  hostname: '127.0.0.1',
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname.startsWith('/auth/')) {
      return app.fetch(req);
    }
    if (url.pathname === '/oauth-callback') {
      const callbackHtml = `<!DOCTYPE html><html><body><script>
        const code = new URL(location.href).searchParams.get('code');
        if (window.opener && code) {
          window.opener.postMessage({ type: 'oauth-complete', code }, '*');
        }
        window.close();
      </script></body></html>`;
      return new Response(callbackHtml, {
        headers: { 'content-type': 'text/html' },
      });
    }
    if (url.pathname === '/' || url.pathname === '/index.html') {
      return new Response(html, {
        headers: { 'content-type': 'text/html' },
      });
    }
    return new Response('not found', { status: 404 });
  },
});

process.stdout.write(`auth e2e harness http://127.0.0.1:${PORT}\n`);
