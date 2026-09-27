/**
 * The in-house IdP against the auth server contract every adapter runs
 * (`@pkgs/auth/contract`). Built through its provider module over a record
 * of secrets, exactly as a composition root builds it.
 */
import {
  type AuthServerContractHarness,
  describeAuthServerContract,
} from '@pkgs/auth/contract';
import {
  IdentityLinker,
  IdpRepository,
  INHOUSE_AUTH_PROVIDER,
  INHOUSE_AUTH_SECRET,
} from '@pkgs/auth-inhouse/server';
import { createSimClock } from '@pkgs/clock';
import { createNoopLogger } from '@pkgs/logger';
import { createPostgresDbScope } from '@pkgs/sql-client/postgres-db-scope';
import { SqlClientImplMockingbirdPostgres } from '@pkgs/sql-client-postgres/impl-mockingbird-postgres';
import { createSimIds } from '@pkgs/uuid';

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
  const migration = INHOUSE_AUTH_PROVIDER.postgresMigration?.({
    dbScope: createPostgresDbScope('public'),
  });
  await migration?.migrate({ sqlClient, logger: createNoopLogger() });
  const { clock } = createSimClock({ startMs: Date.UTC(2026, 0, 1) });
  const { createId } = createSimIds(1);
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
