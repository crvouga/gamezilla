// @io-wall-ok — auth OAuth e2e harness server

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createSimDeps } from '@pkgs/determinism';
import { createNoopLogger } from '@pkgs/logger';
import { SqlClientImplSqliteMem } from '@pkgs/sql-client/sqlite/impl-sqlite-mem';

import { AuthSqliteDatabaseMigration } from '../src/server/auth-database-migration';
import { createAuthApp } from '../src/server/create-auth-app';
import { createFakeGoogleHttp } from '../src/tests/system/fake-google';
import type { AuthSystem } from '../src/tests/system/types';
import {
  AUTH_SYSTEM_SECRET,
  AUTH_SYSTEM_TRUSTED_ORIGINS,
} from '../src/tests/system/types';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = 4178;
const API_ORIGIN = `http://127.0.0.1:${PORT}`;

const authState: AuthSystem = {
  store: null,
  actors: new Map(),
  googleSubjects: new Map(),
  googleFault: false,
  fingerprint: null,
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
  secret: AUTH_SYSTEM_SECRET,
  baseURL: API_ORIGIN,
  trustedOrigins: [
    ...AUTH_SYSTEM_TRUSTED_ORIGINS,
    API_ORIGIN,
    `${API_ORIGIN}/oauth-callback`,
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
