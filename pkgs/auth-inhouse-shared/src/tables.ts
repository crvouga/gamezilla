import { defineTable } from '@pkgs/db-schema-root-shared/define-table';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';

/**
 * One person. Several provider identities (`idp_accounts`) may point at the
 * same user; `email` / `name` / `image` are the profile derived from them.
 */
export const idpUsers = defineTable({
  domain: 'idp',
  name: 'idp_users',
  columns: {
    email: 'text',
    name: 'text',
    image: 'text',
  },
});

/**
 * One provider identity — `(provider, provider_user_id)` — linked to a user.
 * A user holds at most one identity per provider (enforced in code, since an
 * unlinked row is removed rather than tombstoned). What the provider last
 * said about the address is kept per identity: linking by email is only
 * safe when *both* sides say "verified", and an Apple relay address is not
 * the person's real address.
 */
export const idpAccounts = defineTable({
  domain: 'idp',
  name: 'idp_accounts',
  columns: {
    user_id: 'text',
    provider: 'text',
    provider_user_id: 'text',
    access_token: 'text',
    refresh_token: 'text',
    email: 'text',
    email_verified: 'boolean',
    /** Apple Hide My Email relay (never matched for linking). */
    is_private_email: 'boolean',
    /** Apple relay forwarding, switched by `email-disabled/enabled` events. */
    email_forwarding: 'boolean',
    name: 'text',
    picture: 'text',
    last_sign_in_at: 'timestamp',
  },
  indexes: ['user_id', 'email'],
  uniqueIndexes: [['provider', 'provider_user_id']],
});

export const idpSessions = defineTable({
  domain: 'idp',
  name: 'idp_sessions',
  columns: {
    user_id: 'text',
    token_hash: 'text',
    expires_at: 'timestamp',
  },
  indexes: ['user_id'],
  uniqueIndexes: ['token_hash'],
});

/**
 * One OAuth round trip. `intent` says what the callback does with the
 * identity it gets back: sign in (the default), link it to `link_user_id`,
 * or finish a pending link (`pending_link_id`) by proving the other account.
 */
export const idpOauthStates = defineTable({
  domain: 'idp',
  name: 'idp_oauth_states',
  columns: {
    provider: 'text',
    state: 'text',
    code_verifier: 'text',
    callback_url: 'text',
    exchange_code_hash: 'text',
    expires_at: 'timestamp',
    user_id: 'text',
    intent: 'text',
    nonce: 'text',
    link_user_id: 'text',
    pending_link_id: 'text',
  },
  indexes: ['user_id'],
  uniqueIndexes: ['state', 'exchange_code_hash'],
});

/**
 * Proof that a signed-in user asked to link another provider. Minted with
 * the bearer before the popup opens (so the popup launch needs no await) and
 * consumed by the launch it authorizes — only while the session that minted
 * it is still alive: signing out everywhere kills unspent tickets too.
 */
export const idpLinkTickets = defineTable({
  domain: 'idp',
  name: 'idp_link_tickets',
  columns: {
    token_hash: 'text',
    user_id: 'text',
    expires_at: 'timestamp',
    /** `idp_sessions.token_hash` of the session that minted it. */
    session_token_hash: 'text',
  },
  indexes: ['user_id'],
  uniqueIndexes: ['token_hash'],
});

/**
 * A provider identity that just authenticated but whose address matches an
 * existing user without *both* sides being verified. It waits here until the
 * person proves the existing account (then it links) or chooses a separate
 * account — never linked silently.
 */
export const idpPendingLinks = defineTable({
  domain: 'idp',
  name: 'idp_pending_links',
  columns: {
    token_hash: 'text',
    target_user_id: 'text',
    provider: 'text',
    provider_user_id: 'text',
    identity: 'json',
    expires_at: 'timestamp',
  },
  uniqueIndexes: ['token_hash'],
});

/** Provider-signed events already applied (`jti`), so a replay is a no-op. */
export const idpProviderEvents = defineTable({
  domain: 'idp',
  name: 'idp_provider_events',
  columns: {
    provider: 'text',
    jti: 'text',
    type: 'text',
    provider_user_id: 'text',
  },
  uniqueIndexes: [['provider', 'jti']],
});

export const IDP_TABLES = [
  idpUsers,
  idpAccounts,
  idpSessions,
  idpOauthStates,
  idpLinkTickets,
  idpPendingLinks,
  idpProviderEvents,
] as const;

export const idpSchema = registerTables(IDP_TABLES);
