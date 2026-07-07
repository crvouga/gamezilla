import {
  ACCOUNT_PROVIDER_ENTITY_TYPE,
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountProviderAttr,
  AccountSessionAttr,
  DEVICE_ENTITY_TYPE,
  DeviceAttr,
} from '@libs/auth/shared';
import { assertDeviceId, assertUuid } from '@libs/auth/shared/device-id';
import type { AuthServerPort } from '@pkgs/auth/server/auth-server-port';
import type { Entity, PatchDb, PatchInput } from '@pkgs/patch-db/interface';
import {
  PATCHES_DB_SYSTEM_CONTEXT,
  toAttributeState,
} from '@pkgs/patch-db/interface';
import { PatchMetaAttr } from '@pkgs/patch-db/metadata/patch-metadata';

/**
 * Idempotent server-side upsert run from `POST /auth/refresh`. Given a
 * resolved `accountId` (bearer + device pair) plus the client's device snapshot
 * + posted session expiry, makes the following PatchDB tables match the latest
 * server state:
 *
 *   - `account/<accountId>` — already created by `resolveAccountIdFromBearer`,
 *     no extra work here.
 *   - `account/provider/<id>` — one row per auth provider identity.
 *   - `account/session/<id>` — keyed by `(deviceId, accountId)` tuple, holds
 *     bearer token + expiry. Server is the only writer.
 *   - `device/<deviceId>` — populated from the posted `device/...` attribute
 *     record, plus `firstSeenAt` (set once) and `lastSeenAt` (always now).
 *     Caller is responsible for filtering to `device/...` keys; we trust the
 *     input here.
 *
 * Re-running with the same inputs yields no extra patches because each upsert
 * diffs the on-disk attributes before writing.
 */
export async function refreshAuthSnapshot(args: {
  db: PatchDb;
  authServer: AuthServerPort;
  bearerToken: string;
  accountId: string;
  deviceId: string;
  deviceAttributes: Record<string, string>;
  accountSessionExpiresAt: string;
}): Promise<void> {
  const {
    db,
    authServer,
    bearerToken,
    accountId,
    deviceId,
    deviceAttributes,
    accountSessionExpiresAt,
  } = args;
  assertUuid(accountId, 'accountId must be UUID');
  assertDeviceId(deviceId);

  await upsertLinkedProviders({ db, authServer, bearerToken, accountId });
  await upsertAccountSession({
    db,
    accountId,
    deviceId,
    token: bearerToken,
    expiresAt: accountSessionExpiresAt,
  });
  await upsertDeviceEntity({ db, deviceId, attributes: deviceAttributes });
}

async function upsertLinkedProviders(args: {
  db: PatchDb;
  authServer: AuthServerPort;
  bearerToken: string;
  accountId: string;
}): Promise<void> {
  const { db, authServer, bearerToken, accountId } = args;

  let session: Awaited<ReturnType<AuthServerPort['verifySessionToken']>> = null;
  try {
    session = await authServer.verifySessionToken(bearerToken);
  } catch {
    session = null;
  }
  if (session === null) return;

  let email = session.email;
  if (email === null) {
    try {
      const profile = await authServer.getUserProfile(session.externalUserId);
      email = profile?.email ?? null;
    } catch {
      email = null;
    }
  }

  const existing = await readProviderEntitiesForAccount(db, accountId);
  const linkedAt = new Date().toISOString();
  await ensureProviderRow({
    db,
    accountId,
    provider: authServer.providerLabel,
    providerUserId: session.externalUserId,
    email,
    linkedAt,
    existing,
  });
}

async function readProviderEntitiesForAccount(
  db: PatchDb,
  accountId: string
): Promise<Entity[]> {
  const [res] = await db.read(
    [
      {
        entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
        where: {
          type: '=',
          attribute: AccountProviderAttr.accountId.key,
          value: accountId,
        },
        limit: 100,
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  return res?.entities ?? [];
}

function findExistingProvider(
  existing: readonly Entity[],
  provider: string,
  providerUserId: string
): Entity | undefined {
  for (const ent of existing) {
    if (
      ent.attributes[AccountProviderAttr.provider.key] === provider &&
      ent.attributes[AccountProviderAttr.providerUserId.key] === providerUserId
    ) {
      return ent;
    }
  }
  return undefined;
}

async function ensureProviderRow(args: {
  db: PatchDb;
  accountId: string;
  provider: string;
  providerUserId: string;
  email: string | null;
  linkedAt: string;
  existing: readonly Entity[];
}): Promise<void> {
  const { db, accountId, provider, providerUserId, email, linkedAt, existing } =
    args;
  const found = findExistingProvider(existing, provider, providerUserId);
  if (found === undefined) {
    const patch: PatchInput = {
      entityId: globalThis.crypto.randomUUID(),
      entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
      attributes: {
        ...AccountProviderAttr.accountId(accountId),
        ...AccountProviderAttr.provider(provider),
        ...AccountProviderAttr.providerUserId(providerUserId),
        ...(email !== null ? AccountProviderAttr.email(email) : {}),
        ...AccountProviderAttr.linkedAt(linkedAt),
        ...PatchMetaAttr.createdById(accountId),
      },
    };
    await db.write([patch], PATCHES_DB_SYSTEM_CONTEXT);
    return;
  }

  const updates: Record<string, unknown> = {};
  const currentEmail = found.attributes[AccountProviderAttr.email.key];
  if (email !== null && currentEmail !== email) {
    Object.assign(updates, AccountProviderAttr.email(email));
  }
  const currentLinkedAt = found.attributes[AccountProviderAttr.linkedAt.key];
  if (typeof currentLinkedAt !== 'string' || currentLinkedAt.length === 0) {
    Object.assign(updates, AccountProviderAttr.linkedAt(linkedAt));
  }
  if (Object.keys(updates).length === 0) return;
  await db.write(
    [
      {
        entityId: found.entityId,
        entityType: ACCOUNT_PROVIDER_ENTITY_TYPE,
        attributes: updates,
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
}

async function upsertAccountSession(args: {
  db: PatchDb;
  accountId: string;
  deviceId: string;
  token: string;
  expiresAt: string;
}): Promise<void> {
  const { db, accountId, deviceId, token, expiresAt } = args;
  const existing = await findAccountSessionEntity(db, accountId, deviceId);
  const now = new Date().toISOString();
  if (existing === undefined) {
    await db.write(
      [
        {
          entityId: globalThis.crypto.randomUUID(),
          entityType: ACCOUNT_SESSION_ENTITY_TYPE,
          attributes: {
            ...AccountSessionAttr.deviceId(deviceId),
            ...AccountSessionAttr.accountId(accountId),
            ...AccountSessionAttr.token(token),
            ...AccountSessionAttr.expiresAt(expiresAt),
            ...AccountSessionAttr.createdAt(now),
            ...PatchMetaAttr.createdById(accountId),
          },
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );
    return;
  }

  const updates: Record<string, unknown> = {};
  const currentToken = existing.attributes[AccountSessionAttr.token.key];
  if (currentToken !== token) {
    Object.assign(updates, AccountSessionAttr.token(token));
  }
  const currentExpires = existing.attributes[AccountSessionAttr.expiresAt.key];
  if (currentExpires !== expiresAt) {
    Object.assign(updates, AccountSessionAttr.expiresAt(expiresAt));
  }
  if (Object.keys(updates).length === 0) return;
  await db.write(
    [
      {
        entityId: existing.entityId,
        entityType: ACCOUNT_SESSION_ENTITY_TYPE,
        attributes: updates,
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
}

async function findAccountSessionEntity(
  db: PatchDb,
  accountId: string,
  deviceId: string
): Promise<Entity | undefined> {
  const [res] = await db.read(
    [
      {
        entityType: ACCOUNT_SESSION_ENTITY_TYPE,
        where: {
          type: 'and',
          clauses: [
            {
              type: '=',
              attribute: AccountSessionAttr.accountId.key,
              value: accountId,
            },
            {
              type: '=',
              attribute: AccountSessionAttr.deviceId.key,
              value: deviceId,
            },
          ],
        },
        limit: 1,
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  return res?.entities[0];
}

async function upsertDeviceEntity(args: {
  db: PatchDb;
  deviceId: string;
  attributes: Record<string, string | null>;
}): Promise<void> {
  const { db, deviceId, attributes } = args;
  const [res] = await db.read(
    [
      {
        entityType: DEVICE_ENTITY_TYPE,
        entityId: deviceId,
        limit: 1,
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
  const existing = res?.entities[0];
  const now = new Date().toISOString();

  if (existing === undefined) {
    const attrs = toAttributeState({
      ...DeviceAttr.id(deviceId),
      ...DeviceAttr.createdAt(now),
      ...DeviceAttr.firstSeenAt(now),
      ...DeviceAttr.lastSeenAt(now),
      ...attributes,
    } as Record<string, unknown>);
    await db.write(
      [
        {
          entityId: deviceId,
          entityType: DEVICE_ENTITY_TYPE,
          attributes: attrs,
        },
      ],
      PATCHES_DB_SYSTEM_CONTEXT
    );
    return;
  }

  const stored = existing.attributes;
  const storedRec = stored as Record<string, unknown>;
  const existingFirst = readNullableString(stored[DeviceAttr.firstSeenAt.key]);
  const created = readNullableString(stored[DeviceAttr.createdAt.key]);
  const updates: Record<string, unknown> = {
    ...DeviceAttr.lastSeenAt(now),
    ...(existingFirst === null
      ? DeviceAttr.firstSeenAt(created !== null ? created : now)
      : {}),
  };
  for (const [key, next] of Object.entries(attributes)) {
    if (storedRec[key] !== next) {
      updates[key] = next;
    }
  }
  await db.write(
    [
      {
        entityId: deviceId,
        entityType: DEVICE_ENTITY_TYPE,
        attributes: toAttributeState(updates),
      },
    ],
    PATCHES_DB_SYSTEM_CONTEXT
  );
}

function readNullableString(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t.length > 0 ? t : null;
}
