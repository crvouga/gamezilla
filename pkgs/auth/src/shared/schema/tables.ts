import { defineTable, registerTables } from '@pkgs/db-schema';

export const idpUsers = defineTable({
  domain: 'idp',
  name: 'idp_users',
  columns: {
    email: 'text',
    name: 'text',
    image: 'text',
  },
});

export const idpAccounts = defineTable({
  domain: 'idp',
  name: 'idp_accounts',
  columns: {
    user_id: 'text',
    provider: 'text',
    provider_user_id: 'text',
    access_token: 'text',
    refresh_token: 'text',
  },
  indexes: ['user_id'],
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
  },
  indexes: ['user_id'],
  uniqueIndexes: ['state', 'exchange_code_hash'],
});

/** Short-lived provider authorization codes (Dev IdP chooser → callback). */
export const idpProviderAuthCodes = defineTable({
  domain: 'idp',
  name: 'idp_provider_auth_codes',
  columns: {
    oauth_state_id: 'text',
    code_hash: 'text',
    provider_user_id: 'text',
    expires_at: 'timestamp',
  },
  indexes: ['oauth_state_id'],
  uniqueIndexes: ['code_hash'],
});

export const IDP_TABLES = [
  idpUsers,
  idpAccounts,
  idpSessions,
  idpOauthStates,
  idpProviderAuthCodes,
] as const;

export const idpSchema = registerTables(IDP_TABLES);
