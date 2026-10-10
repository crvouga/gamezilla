import {
  equalPasswordHash,
  hashPassword,
  PASSWORD_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@pkgs/auth-inhouse-shared/password';
import { hashAuthSecret } from '@pkgs/auth-inhouse-shared/token-hash';
import sql from '@pkgs/sql-root-shared/sql';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { respondWithSession } from './auth-route-handlers';
import type { CreateAuthAppDeps } from './create-auth-app-types';
import { IdentityLinker } from './identity-linker';
import { IdpRepository, isoFromMs } from './idp-repository';

type Credentials = {
  email: string;
  password: string;
  pendingLink: string | null;
};
type PasswordRow = { user_id: string; salt: string; password_hash: string };
const WINDOW_MS = 10 * 60_000;

async function readCredentials(
  c: Context,
  deps: CreateAuthAppDeps
): Promise<Credentials | null> {
  const origin = c.req.header('origin');
  if (origin !== undefined && !deps.trustedOrigins.includes(origin))
    return null;
  const body: unknown = await c.req.json().catch(() => null);
  if (body === null || typeof body !== 'object') return null;
  const input = body as Record<string, unknown>;
  if (
    typeof input['email'] !== 'string' ||
    typeof input['password'] !== 'string'
  )
    return null;
  const email = input['email'].trim().toLowerCase();
  const password = input['password'];
  if (
    email.length > 254 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    password.length < PASSWORD_MIN_LENGTH ||
    password.length > PASSWORD_MAX_LENGTH
  )
    return null;
  const pendingLink =
    typeof input['pendingLink'] === 'string' ? input['pendingLink'] : null;
  if (
    pendingLink !== null &&
    (pendingLink.length === 0 || pendingLink.length > 256)
  )
    return null;
  return { email, password, pendingLink };
}

/** The database serializes admissions across replicas, before expensive hashing. */
async function admitted(
  deps: CreateAuthAppDeps,
  email: string
): Promise<boolean> {
  const now = isoFromMs(deps.clock.now());
  const cutoff = isoFromMs(deps.clock.now() - WINDOW_MS);
  const id = hashAuthSecret(deps.secret, `password-attempt:${email}`);
  const rows = await deps.getSql().query(sql<{ attempts: number }>`
    INSERT INTO idp_password_attempts (id, created_at, updated_at, window_started_at, attempts)
    VALUES (${id}, ${now}, ${now}, ${now}, 1)
    ON CONFLICT (id) DO UPDATE SET
      attempts = CASE WHEN idp_password_attempts.window_started_at <= ${cutoff} THEN 1 ELSE idp_password_attempts.attempts + 1 END,
      window_started_at = CASE WHEN idp_password_attempts.window_started_at <= ${cutoff} THEN ${now} ELSE idp_password_attempts.window_started_at END,
      updated_at = ${now}
    RETURNING attempts
  `);
  return (rows[0]?.attempts ?? 11) <= 10;
}

async function register(
  deps: CreateAuthAppDeps,
  input: Credentials
): Promise<string | null> {
  const salt = deps.createId();
  const passwordHash = await hashPassword(input.password, salt);
  return deps.getSql().transaction(async (tx) => {
    const users = new IdpRepository(tx, deps.clock, deps.createId, deps.secret);
    const id = deps.createId();
    const now = isoFromMs(deps.clock.now());
    await users.insertUser({ id, email: input.email, name: null, image: null });
    const inserted = await tx.query(sql<{ user_id: string }>`
      INSERT INTO idp_passwords (id, created_at, updated_at, user_id, email, salt, password_hash)
      VALUES (${deps.createId()}, ${now}, ${now}, ${id}, ${input.email}, ${salt}, ${passwordHash})
      ON CONFLICT (email) DO NOTHING RETURNING user_id
    `);
    if (inserted.length === 0) {
      await tx.run(sql`DELETE FROM idp_users WHERE id = ${id}`);
      return null;
    }
    // A chosen address proves no ownership of that mailbox. Never silently link it to OAuth.
    await tx.run(sql`
      INSERT INTO idp_accounts (id, created_at, updated_at, user_id, provider, provider_user_id, email, email_verified, is_private_email, email_forwarding, last_sign_in_at)
      VALUES (${deps.createId()}, ${now}, ${now}, ${id}, ${'password'}, ${id}, ${input.email}, ${false}, ${false}, ${true}, ${now})
    `);
    return id;
  });
}

async function authenticate(
  deps: CreateAuthAppDeps,
  input: Credentials
): Promise<string | null> {
  const rows = await deps
    .getSql()
    .query(
      sql<PasswordRow>`SELECT user_id, salt, password_hash FROM idp_passwords WHERE email = ${input.email} AND deleted_at IS NULL LIMIT 1`
    );
  const row = rows[0];
  // Unknown addresses perform the same derivation, without revealing account existence.
  const hash = await hashPassword(
    input.password,
    row?.salt ?? hashAuthSecret(deps.secret, input.email)
  );
  return row !== undefined && equalPasswordHash(hash, row.password_hash)
    ? row.user_id
    : null;
}

export function createPasswordAuthApp(deps: CreateAuthAppDeps) {
  return new Hono()
    .use('*', bodyLimit({ maxSize: 4096 }))
    .post('/register', async (c) => {
      const input = await readCredentials(c, deps);
      if (input === null) return c.json({ error: 'invalid_credentials' }, 400);
      if (!(await admitted(deps, input.email)))
        return c.json({ error: 'try_later' }, 429);
      const userId = await register(deps, input);
      if (userId === null) return c.json({ error: 'registration_failed' }, 409);
      return respondWithSession(c, deps, userId);
    })
    .post('/sign-in', async (c) => {
      const input = await readCredentials(c, deps);
      if (input === null) return c.json({ error: 'invalid_credentials' }, 400);
      if (!(await admitted(deps, input.email)))
        return c.json({ error: 'try_later' }, 429);
      const userId = await authenticate(deps, input);
      if (userId === null) return c.json({ error: 'invalid_credentials' }, 401);
      if (input.pendingLink !== null) {
        const token = input.pendingLink;
        const outcome = await deps
          .getSql()
          .transaction((tx) =>
            new IdentityLinker(tx, deps).confirmPassword(userId, token)
          );
        if (outcome.kind !== 'signed_in')
          return c.json(
            {
              error: outcome.kind === 'error' ? outcome.error : 'link_mismatch',
            },
            409
          );
      }
      return respondWithSession(c, deps, userId);
    });
}

export type PasswordAuthRPC = ReturnType<typeof createPasswordAuthApp>;
