/**
 * The in-house IdP against the auth server contract every adapter runs
 * (`@pkgs/auth/contract`). Built through its provider module over a record
 * of secrets, exactly as a composition root builds it.
 */
import type { AuthServerContractHarness } from '@pkgs/auth-shared/auth-server-contract';
import { describeAuthServerContract } from '@pkgs/auth-shared/auth-server-contract';
import { IdentityLinker } from '@pkgs/auth-inhouse-server/identity-linker';
import { IdpRepository } from '@pkgs/auth-inhouse-server/idp-repository';
import { INHOUSE_AUTH_PROVIDER } from '@pkgs/auth-inhouse-server/inhouse-auth-provider';
import { INHOUSE_AUTH_SECRET } from '@pkgs/auth-inhouse-server/inhouse-auth-config';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { createPostgresDbScope } from '@pkgs/sql-client-shared/postgres-db-scope';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres-server/impl-mockingbird-postgres';
import { createHarnessIds } from '@pkgs/uuid-shared/seeded-create-id';

const SECRET = 'contract-secret-contract-secret-contract';
const SESSION_LIFETIME_MS = 365 * 24 * 60 * 60 * 1000;

const SECRETS: Readonly<Record<string, string>> = {
  [INHOUSE_AUTH_SECRET.secret]: SECRET,
  [INHOUSE_AUTH_SECRET.googleClientId]: 'contract-client',
  [INHOUSE_AUTH_SECRET.googleClientSecret]: 'contract-client-secret',
  [INHOUSE_AUTH_SECRET.googleIdpOrigin]: 'https://idp.contract.example',
};

async function openInhouseHarness(): Promise<AuthServerContractHarness> {
  const sqlClient = SqlClientImplMockingbirdPostgres.open({ seed: 1 });
  await INHOUSE_AUTH_PROVIDER.reconcilePostgres?.({
    sqlClient,
    dbScope: createPostgresDbScope('public'),
  });
  const { clock } = createHarnessClock({ startMs: Date.UTC(2026, 0, 1) });
  const { createId } = createHarnessIds(1);
  const provider = await INHOUSE_AUTH_PROVIDER.create({
    readSecret: (name) => Promise.resolve(SECRETS[name] ?? null),
    isProduction: false,
    apiOrigin: 'https://api.contract.example',
    apiPathPrefix: '/api',
    clientOrigins: ['https://app.contract.example'],
    clock,
    createId,
    http: {
      fetch: () => Promise.reject(new Error('contract: no outbound HTTP')),
    },
    getSql: () => sqlClient,
    onUserChanged: () => Promise.resolve(),
  });
  const repo = new IdpRepository(sqlClient, clock, createId, SECRET);
  return {
    module: INHOUSE_AUTH_PROVIDER,
    provider,
    // The same linking policy a real callback runs, for an identity whose
    // address the provider vouches for.
    signIn: async (person) => {
      const outcome = await sqlClient.transaction(
        async (tx) =>
          await new IdentityLinker(tx, {
            clock,
            createId,
            secret: SECRET,
          }).signIn(
            {
              provider: person.provider,
              providerUserId: person.subject,
              email: person.email,
              emailVerified: true,
              isPrivateEmail: false,
              name: person.name,
              picture: null,
              accessToken: null,
              refreshToken: null,
            },
            null
          )
      );
      if (outcome.kind !== 'signed_in') {
        throw new Error(`contract: sign-in ended ${outcome.kind}`);
      }
      const session = await repo.createSession(outcome.userId);
      return { token: session.token, externalUserId: outcome.userId };
    },
    signOut: (session) => repo.deleteSessionByToken(session.token),
    expireSessions: () => {
      clock.advance(SESSION_LIFETIME_MS);
      return Promise.resolve();
    },
    close: () => sqlClient.disconnect(),
  };
}

describeAuthServerContract('in-house IdP', openInhouseHarness);
