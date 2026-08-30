import type { AuthContext } from '@libs/auth/public/types';
import { createAuthApp, IdpRepository } from '@pkgs/auth/server';
import { AUTH_SET_TOKEN_HEADER, IDP_PROVIDER_DEV } from '@pkgs/auth/shared';
import type { Clock } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import type { CreateId } from '@pkgs/uuid';
import { Hono } from 'hono';

import type { ApiHonoEnv } from '../app/api-hono-types';
import type { AuthBootConfig } from '../config/auth-boot';
import { requireRequestStore } from '../request-scope';

function readStringField(raw: unknown, key: string): string {
  if (raw === null || typeof raw !== 'object') return '';
  const value = (raw as Record<string, unknown>)[key];
  return typeof value === 'string' ? value.trim() : '';
}

function resolveE2eSubject(raw: unknown): {
  readonly subject: string;
  readonly email: string;
  readonly name: string;
} | null {
  const email = readStringField(raw, 'email');
  const subjectFromBody = readStringField(raw, 'subject');
  const subject =
    subjectFromBody.length > 0
      ? subjectFromBody
      : email.length > 0
        ? (email.split('@')[0] ?? email)
        : '';
  if (subject.length === 0) return null;
  const nameField = readStringField(raw, 'name');
  return {
    subject,
    email: email.length > 0 ? email : `${subject}@dev.local`,
    name: nameField.length > 0 ? nameField : subject,
  };
}

/**
 * Mounts isomorphic IdP routes at `/auth/*` plus a dev-only E2E mint route.
 */
export function createAuthRoutes(args: {
  readonly boot: AuthBootConfig;
  readonly http: HttpClient;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly secretsEnv: string;
}) {
  const app = new Hono<ApiHonoEnv<AuthContext>>();

  const idpApp = createAuthApp({
    getSql: () => requireRequestStore().sqlClient,
    clock: args.clock,
    createId: args.createId,
    http: args.http,
    secret: args.boot.secret,
    baseURL: args.boot.baseURL,
    publicPathPrefix: '/api',
    trustedOrigins: args.boot.trustedOrigins,
    providers: args.boot.providers,
  });

  app.route('/', idpApp);

  if (args.secretsEnv === 'dev') {
    app.post('/identity/e2e/sign-in', async (c) => {
      const store = requireRequestStore();
      const raw: unknown = await c.req.json().catch(() => null);
      const identity = resolveE2eSubject(raw);
      if (identity === null) {
        return c.json({ error: 'missing_subject' }, 400);
      }
      const repo = new IdpRepository(
        store.sqlClient,
        args.clock,
        args.createId,
        args.boot.secret
      );
      const user = await repo.upsertSocialUser({
        provider: IDP_PROVIDER_DEV,
        providerUserId: identity.subject,
        email: identity.email,
        name: identity.name,
        image: null,
      });
      const session = await repo.createSession(user.id);
      c.header(AUTH_SET_TOKEN_HEADER, session.token);
      return c.json(
        {
          token: session.token,
          userId: user.id,
          email: user.email ?? identity.email,
        },
        200
      );
    });
  }

  return app;
}
