/**
 * The simulated IdP's own SQLite schema — one database holding every state
 * category the provider has: directory, clients, browser sessions, parked
 * authorize requests, codes, tokens, consent grants, Apple relay addresses,
 * fault flags and the RS256 signing key.
 *
 * Not part of the product `appSchema`: nothing here is synced, and the IdP
 * owns its file. Managed `created_at` / `updated_at` / `deleted_at` stay NULL
 * — runtime rows are hard-deleted when their explicit epoch-ms TTL expires,
 * so there is nothing to soft-delete or audit by row age.
 *
 * Business keys ride the implicit `id` column (the `kv` convention), so every
 * lookup is a primary-key hit: `sub`, `clientId`, `sessionId`, `requestId`,
 * `code`, `token`, `sub|clientId`, and two singletons (`faults`, `signing`).
 */

import { defineTable, registerTables } from '@pkgs/db-schema';

export const idpSimAccounts = defineTable({
  domain: 'idp_sim',
  name: 'idp_sim_accounts',
  columns: {
    email: 'text',
    email_verified: 'boolean',
    name: 'text',
    given_name: 'text',
    family_name: 'text',
    picture: 'text',
    /** Workspace `hd` claim; NULL for consumer accounts. */
    hd: 'text',
    /** Apple `real_user_status` (0 / 1 / 2). */
    real_user_status: 'integer',
  },
  uniqueIndexes: ['email'],
});

export const idpSimClients = defineTable({
  domain: 'idp_sim',
  name: 'idp_sim_clients',
  columns: {
    client_secret: 'text',
    redirect_uris: 'json',
    app_name: 'text',
    /** Apple Services ID registration (team, key, notification URL). */
    apple: 'json',
  },
});

export const idpSimSessions = defineTable({
  domain: 'idp_sim',
  name: 'idp_sim_sessions',
  columns: {
    /** Signed-in subjects, most recently authenticated last. */
    signed_in: 'json',
  },
});

export const idpSimAuthRequests = defineTable({
  domain: 'idp_sim',
  name: 'idp_sim_auth_requests',
  columns: {
    client_id: 'text',
    redirect_uri: 'text',
    scopes: 'json',
    state: 'text',
    nonce: 'text',
    code_challenge: 'text',
    code_challenge_method: 'text',
    access_type: 'text',
    prompts: 'json',
    login_hint: 'text',
    created_at_ms: 'integer',
    chosen_sub: 'text',
    /** Address parked between the identifier and password steps. */
    identifier_email: 'text',
    response_type: 'text',
    response_mode: 'text',
  },
  indexes: ['created_at_ms'],
});

export const idpSimAuthCodes = defineTable({
  domain: 'idp_sim',
  name: 'idp_sim_auth_codes',
  columns: {
    client_id: 'text',
    redirect_uri: 'text',
    sub: 'text',
    scopes: 'json',
    nonce: 'text',
    code_challenge: 'text',
    code_challenge_method: 'text',
    issue_refresh_token: 'boolean',
    expires_at_ms: 'integer',
    /** Google kills the whole grant when a code is replayed. */
    redeemed: 'boolean',
    /** Apple: the code that finished the app's first authorization. */
    first_authorization: 'boolean',
    auth_time_ms: 'integer',
  },
  indexes: ['expires_at_ms'],
});

export const idpSimAccessTokens = defineTable({
  domain: 'idp_sim',
  name: 'idp_sim_access_tokens',
  columns: {
    sub: 'text',
    client_id: 'text',
    scopes: 'json',
    expires_at_ms: 'integer',
  },
  indexes: ['expires_at_ms'],
});

export const idpSimRefreshTokens = defineTable({
  domain: 'idp_sim',
  name: 'idp_sim_refresh_tokens',
  columns: {
    sub: 'text',
    client_id: 'text',
    scopes: 'json',
    revoked: 'boolean',
  },
});

export const idpSimGrants = defineTable({
  domain: 'idp_sim',
  name: 'idp_sim_grants',
  columns: {
    sub: 'text',
    client_id: 'text',
    scopes: 'json',
    /** Apple "Share / Hide My Email"; NULL on Google. */
    email_choice: 'text',
  },
  uniqueIndexes: [['sub', 'client_id']],
});

/**
 * Apple private relay addresses, keyed `sub|teamId`: one stable address per
 * account per developer team, whose forwarding the holder can switch off.
 */
export const idpSimRelayAddresses = defineTable({
  domain: 'idp_sim',
  name: 'idp_sim_relay_addresses',
  columns: {
    sub: 'text',
    team_id: 'text',
    email: 'text',
    forwarding: 'boolean',
  },
  uniqueIndexes: ['email'],
});

export const idpSimFaults = defineTable({
  domain: 'idp_sim',
  name: 'idp_sim_faults',
  columns: {
    payload: 'json',
  },
});

export const idpSimSigningKeys = defineTable({
  domain: 'idp_sim',
  name: 'idp_sim_signing_keys',
  columns: {
    kid: 'text',
    alg: 'text',
    private_jwk: 'json',
    public_jwk: 'json',
  },
});

export const IDP_SIM_TABLES = [
  idpSimAccounts,
  idpSimClients,
  idpSimSessions,
  idpSimAuthRequests,
  idpSimAuthCodes,
  idpSimAccessTokens,
  idpSimRefreshTokens,
  idpSimGrants,
  idpSimRelayAddresses,
  idpSimFaults,
  idpSimSigningKeys,
] as const;

export const idpSimSchema = registerTables(IDP_SIM_TABLES);

/** Singleton row ids for the two keyed-singleton tables. */
export const IDP_SIM_FAULTS_ID = 'faults';
export const IDP_SIM_SIGNING_KEY_ID = 'signing';
