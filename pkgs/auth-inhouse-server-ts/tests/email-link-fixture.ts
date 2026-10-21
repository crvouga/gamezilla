import { createAuthApp } from '@pkgs/auth-inhouse-server-ts/create-auth-app';
import type { CreateAuthAppDeps } from '@pkgs/auth-inhouse-server-ts/create-auth-app-types';
import { createEmailInboxEmulator } from '@pkgs/auth-inhouse-server-ts/email-inbox-emulator';
import type { ProviderIdentity } from '@pkgs/auth-inhouse-server-ts/provider-identity';
import { reconcileIdpPostgres } from '@pkgs/auth-inhouse-server-ts/reconcile-idp-postgres';
import { reconcileIdpSqlite } from '@pkgs/auth-inhouse-server-ts/reconcile-idp-sqlite';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server-ts/impl-mockingbird-postgres';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import { createHarnessIds } from '@pkgs/uuid-shared-ts/seeded-create-id';

export const SECRET = 'email-link-test-secret-0123456789abcdef';
export const APP_ORIGIN = 'https://app.example';
export const CALLBACK_URL = `${APP_ORIGIN}/sso-callback`;
/** The fixture's host mails every address except this domain's. */
export const UNSERVED_ADDRESS = 'carol@unserved.example';

export type Fabric = 'sqlite' | 'postgres';
export const FABRICS: Fabric[] = ['sqlite', 'postgres'];

export type SessionJson = {
  readonly token: string;
  readonly user: { readonly id: string; readonly email: string | null };
};

/** A provider identity as a Google callback would hand it over. */
export function googleIdentity(
  email: string,
  emailVerified: boolean
): ProviderIdentity {
  return {
    provider: 'google',
    providerUserId: `google-${email}`,
    email,
    emailVerified,
    isPrivateEmail: false,
    name: null,
    picture: null,
    accessToken: null,
    refreshToken: null,
  };
}

async function openDb(fabric: Fabric): Promise<SqlClient> {
  if (fabric === 'sqlite') {
    const db = SqlClientImplMockingbirdSqlite.open({ seed: 41 });
    await reconcileIdpSqlite(db);
    return db;
  }
  const db = SqlClientImplMockingbirdPostgres.open({ seed: 41 });
  await reconcileIdpPostgres(db);
  return db;
}

export async function emailLinkFixture(
  options: {
    readonly fabric?: Fabric;
    readonly emailSignIn?: boolean;
    /** A mail service that is down: accepting, then failing every send. */
    readonly mailDown?: boolean;
  } = {}
) {
  const { clock } = createHarnessClock({ startMs: Date.UTC(2026, 0, 1) });
  const { createId } = createHarnessIds(41);
  const db = await openDb(options.fabric ?? 'sqlite');
  const inbox = createEmailInboxEmulator({
    accepts: (email) => !email.endsWith('@unserved.example'),
  });
  const deps: CreateAuthAppDeps = {
    getSql: () => db,
    clock,
    createId,
    secret: SECRET,
    baseURL: 'https://auth.example',
    trustedOrigins: [APP_ORIGIN],
    providers: {},
    http: { fetch: () => Promise.reject(new Error('Unexpected egress')) },
    ...(options.emailSignIn === false
      ? {}
      : {
          emailLinks:
            options.mailDown === true
              ? {
                  accepts: inbox.delivery.accepts,
                  deliver: () => Promise.reject(new Error('Mail is down')),
                }
              : inbox.delivery,
        }),
  };
  // Two replicas over one database, as two Workers would be.
  const apps = [createAuthApp(deps), createAuthApp(deps)];
  const post = (
    path: string,
    value: unknown,
    replica = 0,
    headers: Record<string, string> = {}
  ): Promise<Response> =>
    Promise.resolve(
      apps[replica]!.request(`https://auth.example/auth/${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(value),
      })
    );
  /** Ask for a link and return the token mailed for it. */
  const mailedToken = async (
    email: string,
    extra: Record<string, string> = {}
  ): Promise<string> => {
    const before = inbox.all().length;
    const res = await post('email/request', { email, ...extra });
    const mail = inbox.all()[before];
    if (res.status !== 202 || mail === undefined) {
      throw new Error(`No link was mailed to ${email} (${String(res.status)})`);
    }
    return mail.token;
  };
  /** Ask for a link and open it: the session it yields. */
  const signIn = async (email: string): Promise<SessionJson> => {
    const res = await post('email/confirm', {
      token: await mailedToken(email),
    });
    if (res.status !== 200) {
      throw new Error(`${email} was not signed in (${String(res.status)})`);
    }
    return (await res.json()) as SessionJson;
  };
  return { db, clock, deps, inbox, post, mailedToken, signIn };
}
