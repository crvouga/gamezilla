export const USERS_TABLE = 'users' as const;
export const EXTERNAL_ACCOUNTS_TABLE = 'external_accounts' as const;

export const ExternalAccountCol = {
  userId: 'user_id',
  provider: 'provider',
  externalId: 'external_id',
  metadata: 'metadata',
  createdAt: 'created_at',
} as const;

export const UserTableCol = {
  id: 'id',
  createdAt: 'created_at',
} as const;
