// @io-wall-ok — auth OAuth e2e harness server

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSimDeps } from '@pkgs/determinism';
import { createNoopLogger } from '@pkgs/logger';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

import { AuthSqliteDatabaseMigration } from '../src/server/auth-database-migration';
import { createAuthApp } from '../src/server/create-auth-app';
import { createFakeGoogleHttp } from '../src/testing/fake-google';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 4178;
const API_ORIGIN = `http://127.0.0.1:${PORT}`;
const AUTH_SECRET = 'auth-system-secret-0123456789abcdef';

const authState = {
  googleSubjects: new Map<string, string>(),
  googleFault: false,
};

const deps = createSimDeps({ seed: 1 });
const sql = SqlClientImplSqliteMem.open({ seed: 1 });
await new AuthSqliteDatabaseMigration().migrate({
  sqlClient: sql,
  logger: createNoopLogger(),
});

const app = createAuthApp({
  getSql: () => sql,
  clock: deps.clock,
  createId: deps.createId,
  http: createFakeGoogleHttp(authState),
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
    google: { clientId: 'cid', clientSecret: 'csecret' },
    dev: { enabled: true },
  },
});

const html = readFileSync(join(here, 'harness', 'oauth-harness.html'), 'utf8');

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
