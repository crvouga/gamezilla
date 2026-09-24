/**
 * The IdP's own state, behind one async, SQLite-backed boundary.
 *
 * Routes and business helpers only ever see this class — no route reaches into
 * a table. Every read/write goes through SQLite, so the durability of a stack
 * (`memory`, an instance file, an explicit path) is a property of the database
 * the composition root opened, not a switch inside the provider.
 *
 * `tx()` is the only way to group writes: authorize submission, code
 * redemption and reset each run as one transaction.
 */

import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, utf8ToBytes } from '@noble/hashes/utils.js';
import type { Clock } from '@pkgs/clock';
import { createNoopLogger, type Logger } from '@pkgs/logger';
import type { SqlClient, SqlTx } from '@pkgs/sql-client/interface';
import type { CreateId } from '@pkgs/uuid';
import type { JWK } from 'jose';

import {
  IDP_DEFAULT_FAULTS,
  type IdpAccessToken,
  type IdpAccount,
  type IdpAccountDraft,
  type IdpAuthCode,
  type IdpAuthRequest,
  type IdpBrowserSession,
  type IdpClient,
  type IdpEmailChoice,
  type IdpFaults,
  type IdpGrant,
  type IdpProviderKind,
  type IdpRefreshToken,
  type IdpRelayAddress,
} from '../shared/types';
import {
  exportIdpSigningKeyRecord,
  type IdpSigningKeys,
  importIdpSigningKeyRecord,
  withKid,
} from './idp-keys';
import { IdpSimSqliteDatabaseMigration } from './schema/sqlite-database-migration';
import * as accounts from './store/accounts';
import * as runtime from './store/runtime';
import * as state from './store/state';

/** Google authorization codes are short lived; ten minutes is the documented cap. */
export const IDP_AUTH_CODE_TTL_MS = 10 * 60 * 1000;
/** Google access tokens come back with `expires_in: 3599`. */
export const IDP_ACCESS_TOKEN_TTL_MS = 3599 * 1000;
/** Apple authorization codes are single-use and valid for five minutes. */
export const IDP_APPLE_AUTH_CODE_TTL_MS = 5 * 60 * 1000;
/** Apple access tokens: `expires_in: 3600`. */
export const IDP_APPLE_ACCESS_TOKEN_TTL_MS = 3600 * 1000;
/** Where Apple forwards Hide My Email mail from. */
export const IDP_APPLE_RELAY_DOMAIN = 'privaterelay.appleid.com';
/** Parked authorize requests expire so an abandoned tab cannot be resumed. */
export const IDP_AUTH_REQUEST_TTL_MS = 30 * 60 * 1000;
/**
 * Codes are kept well past their TTL so a late exchange gets the honest
 * `invalid_grant` / "Code has expired" answer rather than "malformed".
 */
export const IDP_AUTH_CODE_RETENTION_MS = 60 * 60 * 1000;

export type IdpStoreDeps = {
  /** Which provider's wire and directory shapes this store serves. */
  readonly provider: IdpProviderKind;
  /** An open SQLite database. The caller owns connecting and closing it. */
  readonly sqlClient: SqlClient;
  readonly clock: Clock;
  readonly createId: CreateId;
  /**
   * Mints the RS256 pair when the store has none yet. Only a composition root
   * supplies this: a durable store mints once and imports it on every restart.
   */
  readonly createKeys: () => Promise<IdpSigningKeys>;
  readonly logger?: Logger;
};

export function grantKey(sub: string, clientId: string): string {
  return `${sub}|${clientId}`;
}

function relayKey(sub: string, teamId: string): string {
  return `${sub}|${teamId}`;
}

async function resolveSigningKeys(
  db: SqlTx,
  createKeys: () => Promise<IdpSigningKeys>
): Promise<IdpSigningKeys> {
  const stored = await state.readSigningKeyRecord(db);
  if (stored !== null) return await importIdpSigningKeyRecord(stored);
  const keys = await createKeys();
  await state.writeSigningKeyRecord(db, await exportIdpSigningKeyRecord(keys));
  return keys;
}

type IdpStoreRuntime = {
  readonly provider: IdpProviderKind;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly createKeys: () => Promise<IdpSigningKeys>;
  /**
   * The signing key in use, plus the one it replaced: like Google's JWKS, a
   * rotation keeps the previous key published so tokens minted a moment ago
   * still verify.
   */
  readonly keyRing: {
    current: IdpSigningKeys;
    previous: IdpSigningKeys | null;
  };
  /**
   * Transactions queue here. One SQLite connection cannot hold two open
   * transactions, and two browser tabs can submit at once, so BEGIN/COMMIT is
   * serialized per store rather than trusted to the driver.
   */
  readonly txQueue: { tail: Promise<void> };
};

export class IdpStore {
  static async open(deps: IdpStoreDeps): Promise<IdpStore> {
    const logger = deps.logger ?? createNoopLogger();
    await new IdpSimSqliteDatabaseMigration().migrate({
      sqlClient: deps.sqlClient,
      logger,
    });
    const keys = await resolveSigningKeys(deps.sqlClient, deps.createKeys);
    return new IdpStore(
      deps.sqlClient,
      {
        provider: deps.provider,
        clock: deps.clock,
        createId: deps.createId,
        createKeys: deps.createKeys,
        keyRing: { current: keys, previous: null },
        txQueue: { tail: Promise.resolve() },
      },
      deps.sqlClient
    );
  }

  private constructor(
    private readonly sqlClient: SqlClient,
    private readonly runtimeDeps: IdpStoreRuntime,
    private readonly db: SqlTx
  ) {}

  /** Transaction-scoped view: same identity, writes share one SQLite txn. */
  async tx<T>(fn: (store: IdpStore) => Promise<T>): Promise<T> {
    const queue = this.runtimeDeps.txQueue;
    const run = async (): Promise<T> =>
      await this.sqlClient.transaction(async (tx) =>
        fn(new IdpStore(this.sqlClient, this.runtimeDeps, tx))
      );
    const queued = queue.tail.then(run, run);
    queue.tail = queued.then(
      () => undefined,
      () => undefined
    );
    return await queued;
  }

  get clock(): Clock {
    return this.runtimeDeps.clock;
  }

  get createId(): CreateId {
    return this.runtimeDeps.createId;
  }

  get provider(): IdpProviderKind {
    return this.runtimeDeps.provider;
  }

  get keys(): IdpSigningKeys {
    return this.runtimeDeps.keyRing.current;
  }

  /** Every key a verifier may meet: the current one first. */
  publishedJwks(): JWK[] {
    const ring = this.runtimeDeps.keyRing;
    return [
      ring.current,
      ...(ring.previous === null ? [] : [ring.previous]),
    ].map((keys) => keys.publicJwk);
  }

  /** Mint a new signing key; the old one stays published until the next. */
  async rotateSigningKeys(): Promise<IdpSigningKeys> {
    const ring = this.runtimeDeps.keyRing;
    const kid = `${this.provider}-${this.createId().slice(0, 8)}`;
    const next = withKid(await this.runtimeDeps.createKeys(), kid);
    await state.writeSigningKeyRecord(
      this.db,
      await exportIdpSigningKeyRecord(next)
    );
    ring.previous = ring.current;
    ring.current = next;
    return next;
  }

  /** A key nobody published — what `idTokenSignedWithUnknownKey` signs with. */
  async unpublishedSigningKeys(): Promise<IdpSigningKeys> {
    return withKid(await this.runtimeDeps.createKeys(), 'unpublished');
  }

  async accounts(): Promise<IdpAccount[]> {
    return await accounts.selectAccounts(this.db);
  }

  async accountBySub(sub: string): Promise<IdpAccount | null> {
    return await accounts.selectAccountBySub(this.db, sub);
  }

  async accountByEmail(email: string): Promise<IdpAccount | null> {
    return await accounts.selectAccountByEmail(this.db, email);
  }

  async upsertAccount(draft: IdpAccountDraft): Promise<IdpAccount> {
    return await accounts.upsertAccount(this.db, this.provider, draft);
  }

  async seedAccount(draft: IdpAccountDraft): Promise<IdpAccount> {
    return await accounts.seedAccount(this.db, this.provider, draft);
  }

  /** Gone for good: grants, tokens and relay addresses go with it. */
  async deleteAccount(sub: string): Promise<void> {
    await runtime.deleteAccountState(this.db, sub);
    await accounts.deleteAccount(this.db, sub);
  }

  async clients(): Promise<IdpClient[]> {
    return await accounts.selectClients(this.db);
  }

  async client(clientId: string): Promise<IdpClient | null> {
    return await accounts.selectClient(this.db, clientId);
  }

  async registerClient(client: IdpClient): Promise<IdpClient> {
    return await accounts.writeClient(this.db, client);
  }

  /**
   * The browser behind a cookie, created on first sight. Google hands out a
   * session before asking anything, so an abandoned tab still comes back.
   */
  async ensureSession(sessionId: string | null): Promise<IdpBrowserSession> {
    if (sessionId !== null) {
      const existing = await runtime.selectSession(this.db, sessionId);
      if (existing !== null) return existing;
    }
    const created: IdpBrowserSession = { id: this.createId(), signedIn: [] };
    await runtime.insertSession(this.db, created);
    return created;
  }

  async markSignedIn(
    sessionId: string | null,
    sub: string
  ): Promise<IdpBrowserSession> {
    const session = await this.ensureSession(sessionId);
    const signedIn = [...session.signedIn.filter((id) => id !== sub), sub];
    await runtime.writeSessionSignedIn(this.db, session.id, signedIn);
    return { id: session.id, signedIn };
  }

  /** Accounts the chooser should offer, most recently used first. */
  async sessionAccounts(
    session: IdpBrowserSession
  ): Promise<readonly IdpAccount[]> {
    const out: IdpAccount[] = [];
    for (const sub of [...session.signedIn].reverse()) {
      const account = await accounts.selectAccountBySub(this.db, sub);
      if (account !== null) out.push(account);
    }
    return out;
  }

  async authRequest(id: string): Promise<IdpAuthRequest | null> {
    return await runtime.selectAuthRequest(this.db, id);
  }

  async putAuthRequest(request: IdpAuthRequest): Promise<void> {
    await runtime.insertAuthRequest(this.db, request);
  }

  async chooseAuthRequestAccount(
    id: string,
    sub: string | null
  ): Promise<void> {
    await runtime.setAuthRequestChosen(this.db, id, sub);
  }
  /** Park the identifier-step address on the request, or clear it. */
  async setAuthRequestIdentifier(
    id: string,
    email: string | null
  ): Promise<void> {
    await runtime.setAuthRequestIdentifier(this.db, id, email);
  }

  async deleteAuthRequest(id: string): Promise<void> {
    await runtime.deleteAuthRequest(this.db, id);
  }

  async authCode(code: string): Promise<IdpAuthCode | null> {
    return await runtime.selectAuthCode(this.db, code);
  }

  async putAuthCode(code: IdpAuthCode): Promise<void> {
    await runtime.insertAuthCode(this.db, code);
  }

  /** Google invalidates the whole grant when a code is replayed. */
  async redeemAuthCode(code: string): Promise<void> {
    await runtime.redeemAuthCode(this.db, code);
  }

  async accessToken(token: string): Promise<IdpAccessToken | null> {
    return await runtime.selectAccessToken(this.db, token);
  }

  async putAccessToken(token: IdpAccessToken): Promise<void> {
    await runtime.insertAccessToken(this.db, token);
  }

  async deleteAccessToken(token: string): Promise<void> {
    await runtime.deleteAccessToken(this.db, token);
  }

  async refreshToken(token: string): Promise<IdpRefreshToken | null> {
    return await runtime.selectRefreshToken(this.db, token);
  }

  async putRefreshToken(token: IdpRefreshToken): Promise<void> {
    await runtime.insertRefreshToken(this.db, token);
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await runtime.revokeRefreshToken(this.db, token);
  }

  async grant(sub: string, clientId: string): Promise<IdpGrant | null> {
    return await runtime.selectGrant(this.db, grantKey(sub, clientId));
  }

  async grantsForSub(sub: string): Promise<IdpGrant[]> {
    return await runtime.selectGrantsForSub(this.db, sub);
  }

  async hasGrant(
    sub: string,
    clientId: string,
    scopes: readonly string[]
  ): Promise<boolean> {
    const approved = await this.grant(sub, clientId);
    if (approved === null) return false;
    return scopes.every((scope) => approved.scopes.includes(scope));
  }

  /**
   * Widen the app's grant to cover `scopes`. An Apple email choice is made
   * once, on the first authorization, and never re-asked: `null` keeps it.
   */
  async recordGrant(
    sub: string,
    clientId: string,
    scopes: readonly string[],
    emailChoice: IdpEmailChoice | null = null
  ): Promise<IdpGrant> {
    const existing = await this.grant(sub, clientId);
    const merged = [
      ...new Set([...(existing?.scopes ?? []), ...scopes]),
    ].sort();
    const grant: IdpGrant = {
      sub,
      clientId,
      scopes: merged,
      emailChoice: emailChoice ?? existing?.emailChoice ?? null,
    };
    await runtime.writeGrant(this.db, grantKey(sub, clientId), grant);
    return grant;
  }

  /**
   * The holder stopped using this account with the app ("Stop using Apple
   * ID", Google's "Remove access"): the grant and every token for it go.
   */
  async revokeGrant(sub: string, clientId: string): Promise<void> {
    await runtime.deleteGrant(this.db, grantKey(sub, clientId));
    await runtime.revokeGrantTokens(this.db, sub, clientId);
  }

  /** The account's stable relay address for one developer team. */
  async relayAddress(sub: string, teamId: string): Promise<IdpRelayAddress> {
    const key = relayKey(sub, teamId);
    const existing = await runtime.selectRelayAddress(this.db, key);
    if (existing !== null) return existing;
    // Stable per account per team, like Apple's: re-authorizing after a
    // revocation hands the app the very same relay.
    const local = bytesToHex(sha256(utf8ToBytes(key))).slice(0, 12);
    const relay: IdpRelayAddress = {
      sub,
      teamId,
      email: `${local}@${IDP_APPLE_RELAY_DOMAIN}`,
      forwarding: true,
    };
    await runtime.insertRelayAddress(this.db, key, relay);
    return relay;
  }

  async relayAddressByEmail(email: string): Promise<IdpRelayAddress | null> {
    return await runtime.selectRelayAddressByEmail(
      this.db,
      email.trim().toLowerCase()
    );
  }

  async setRelayForwarding(
    sub: string,
    teamId: string,
    forwarding: boolean
  ): Promise<void> {
    await this.relayAddress(sub, teamId);
    await runtime.writeRelayForwarding(
      this.db,
      relayKey(sub, teamId),
      forwarding
    );
  }

  async faults(): Promise<IdpFaults> {
    return await state.readFaults(this.db);
  }

  async setFaults(faults: IdpFaults): Promise<void> {
    await state.writeFaults(this.db, faults);
  }

  /** Drop everything time has invalidated, before a read that depends on it. */
  async sweepExpired(): Promise<void> {
    const now = this.clock.now();
    await runtime.sweepExpiredRows(this.db, {
      authRequestsBeforeMs: now - IDP_AUTH_REQUEST_TTL_MS,
      authCodesBeforeMs: now - IDP_AUTH_CODE_RETENTION_MS,
      accessTokensBeforeMs: now,
    });
  }

  /** A replayed code kills every access + refresh token for that grant. */
  async revokeGrantTokens(sub: string, clientId: string): Promise<void> {
    await runtime.revokeGrantTokens(this.db, sub, clientId);
  }

  /** Drop browser sessions only — the `/__idp/sign-out` control. */
  async clearSessions(): Promise<void> {
    await runtime.deleteSessions(this.db);
  }

  async resetFaults(): Promise<void> {
    await state.writeFaults(this.db, IDP_DEFAULT_FAULTS);
  }

  async resetRuntimeState(): Promise<void> {
    await runtime.deleteRuntimeState(this.db);
  }

  async stats(): Promise<runtime.IdpStats> {
    return await runtime.selectStats(this.db);
  }
}
