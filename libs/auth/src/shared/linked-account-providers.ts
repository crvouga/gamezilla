type OAuthAccountJson = Record<string, unknown>;

export type LinkedProvider = {
  readonly id: string;
  readonly accountId: string;
  readonly provider: string;
  readonly providerUserId: string;
  readonly email: string | null;
  readonly linkedAt: string;
};

export type LinkedProviderField =
  | 'id'
  | 'accountId'
  | 'provider'
  | 'providerUserId'
  | 'email'
  | 'linkedAt';

export type PrimaryAuthExternalAccountSource = {
  readonly externalId: string;
  readonly metadata: unknown;
  readonly createdAt: string;
};

export type LinkedProviderSources = {
  readonly accountId: string;
  readonly primaryAuthProvider: string;
  readonly primaryAuthExternalAccount: PrimaryAuthExternalAccountSource | null;
  readonly authSnapshotData: Record<string, unknown> | null;
  readonly entityCreatedAt: string | null;
};

function readString(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parseMetadataEmail(metadata: unknown): string | null {
  if (metadata === null || metadata === undefined) return null;
  if (typeof metadata === 'string') {
    try {
      const parsed = JSON.parse(metadata) as unknown;
      if (typeof parsed === 'object' && parsed !== null) {
        return readString((parsed as Record<string, unknown>)['email']);
      }
    } catch {
      return null;
    }
    return null;
  }
  if (typeof metadata === 'object') {
    return readString((metadata as Record<string, unknown>)['email']);
  }
  return null;
}

function parseEntityStoreData(raw: unknown): Record<string, unknown> | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw) as unknown;
      return typeof parsed === 'object' && parsed !== null
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  if (typeof raw === 'object') {
    return raw as Record<string, unknown>;
  }
  return null;
}

function readOAuthProviderUserId(oauth: OAuthAccountJson): string {
  return (
    readString(oauth['accountId']) ??
    readString(oauth['provider_user_id']) ??
    readString(oauth['providerUserId']) ??
    readString(oauth['id']) ??
    ''
  );
}

function readOAuthEmail(
  oauth: OAuthAccountJson,
  snapshotEmail: string | null
): string | null {
  return (
    readString(oauth['email']) ??
    readString(oauth['email_address']) ??
    readString(oauth['emailAddress']) ??
    snapshotEmail
  );
}

function readOAuthLinkedAt(oauth: OAuthAccountJson, fallback: string): string {
  const createdAt = oauth['createdAt'];
  if (createdAt instanceof Date) {
    return createdAt.toISOString();
  }
  const asString = readString(createdAt);
  if (asString !== null) {
    const ms = Date.parse(asString);
    if (!Number.isNaN(ms)) return new Date(ms).toISOString();
  }
  return fallback;
}

function readOAuthAccounts(data: Record<string, unknown>): OAuthAccountJson[] {
  const raw =
    data['accounts'] ?? data['external_accounts'] ?? data['externalAccounts'];
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (entry): entry is OAuthAccountJson =>
      entry !== null && typeof entry === 'object'
  );
}

function buildPrimaryAuthProviderRow(args: {
  readonly accountId: string;
  readonly primaryAuthProvider: string;
  readonly externalUserId: string;
  readonly email: string | null;
  readonly linkedAt: string;
}): LinkedProvider {
  return {
    id: `${args.accountId}:${args.primaryAuthProvider}:${args.externalUserId}`,
    accountId: args.accountId,
    provider: args.primaryAuthProvider,
    providerUserId: args.externalUserId,
    email: args.email,
    linkedAt: args.linkedAt,
  };
}

function buildOAuthProviderRows(args: {
  readonly accountId: string;
  readonly snapshot: Record<string, unknown>;
  readonly entityCreatedAt: string;
}): LinkedProvider[] {
  const snapshotEmail = readString(args.snapshot['email']);
  const rows: LinkedProvider[] = [];
  for (const oauth of readOAuthAccounts(args.snapshot)) {
    const provider =
      readString(oauth['providerId']) ?? readString(oauth['provider']);
    const oauthId = readString(oauth['id']);
    if (provider === null || oauthId === null) continue;
    const providerUserId = readOAuthProviderUserId(oauth);
    if (providerUserId.length === 0) continue;
    rows.push({
      id: `${args.accountId}:${provider}:${oauthId}`,
      accountId: args.accountId,
      provider,
      providerUserId,
      email: readOAuthEmail(oauth, snapshotEmail),
      linkedAt: readOAuthLinkedAt(oauth, args.entityCreatedAt),
    });
  }
  return rows;
}

export function buildLinkedProviders(
  sources: LinkedProviderSources
): LinkedProvider[] {
  const primaryAuth = sources.primaryAuthExternalAccount;
  if (primaryAuth === null) return [];

  const snapshot = sources.authSnapshotData ?? { id: primaryAuth.externalId };
  const entityCreatedAt =
    sources.entityCreatedAt ??
    primaryAuth.createdAt ??
    new Date(0).toISOString();
  const primaryAuthEmail =
    parseMetadataEmail(primaryAuth.metadata) ?? readString(snapshot['email']);

  return [
    buildPrimaryAuthProviderRow({
      accountId: sources.accountId,
      primaryAuthProvider: sources.primaryAuthProvider,
      externalUserId: primaryAuth.externalId,
      email: primaryAuthEmail,
      linkedAt: primaryAuth.createdAt,
    }),
    ...buildOAuthProviderRows({
      accountId: sources.accountId,
      snapshot,
      entityCreatedAt,
    }),
  ];
}

export function readLinkedProviderField(
  providerId: string,
  field: LinkedProviderField,
  sources: LinkedProviderSources
): string | null {
  const row = buildLinkedProviders(sources).find(
    (entry) => entry.id === providerId
  );
  if (row === undefined) return null;
  switch (field) {
    case 'id':
      return row.id;
    case 'accountId':
      return row.accountId;
    case 'provider':
      return row.provider;
    case 'providerUserId':
      return row.providerUserId;
    case 'email':
      return row.email;
    case 'linkedAt':
      return row.linkedAt;
  }
}

export { parseEntityStoreData, parseMetadataEmail };
