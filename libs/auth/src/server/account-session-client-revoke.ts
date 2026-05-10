import {
  ACCOUNT_SESSION_ENTITY_TYPE,
  AccountSessionAttr,
} from '@gamezilla/domain/auth';
import { namespacePrefixOf } from '@gamezilla/lib/keyword';
import type { SqlClient } from '@gamezilla/lib/sql-client/interface';
import { ForbiddenError } from '@gamezilla/patch-db/forbidden-error';
import type { PatchInput } from '@gamezilla/patch-db/interface';
import { PATCH_META_KEYS } from '@gamezilla/patch-db/interface';

function isPatchMetaAttributeKey(key: string): boolean {
  if ((PATCH_META_KEYS as readonly string[]).includes(key)) return true;
  return namespacePrefixOf(key) === 'patch';
}

function parseSnapshotAttributes(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    return JSON.parse(raw) as Record<string, unknown>;
  }
  return raw as Record<string, unknown>;
}

function assertSessionScope(
  snap: Record<string, unknown>,
  deviceId: string,
  accountId: string
): void {
  const sid = snap[AccountSessionAttr.deviceId.key];
  const aid = snap[AccountSessionAttr.accountId.key];
  if (sid !== deviceId || aid !== accountId) {
    throw new ForbiddenError('accountSession scope mismatch');
  }
}

function assertRevocationToken(value: unknown): void {
  if (value !== null && value !== undefined) {
    throw new ForbiddenError('accountSession token may only be cleared');
  }
}

function assertRevocationExpiresAt(value: unknown): void {
  if (typeof value !== 'string') {
    throw new ForbiddenError('accountSession expiresAt must be ISO string');
  }
  const t = Date.parse(value);
  if (Number.isNaN(t) || t > Date.now()) {
    throw new ForbiddenError('accountSession must be expired for revoke');
  }
}

function assertRevocationAttribute(key: string, value: unknown): boolean {
  if (key === AccountSessionAttr.token.key) {
    assertRevocationToken(value);
    return true;
  }
  if (key === AccountSessionAttr.expiresAt.key) {
    assertRevocationExpiresAt(value);
    return true;
  }
  throw new ForbiddenError('accountSession client writes are revoke-only');
}

function assertRevocationShape(patch: PatchInput): void {
  let sawRevocationField = false;
  for (const [key, value] of Object.entries(patch.attributes)) {
    if (isPatchMetaAttributeKey(key)) continue;
    sawRevocationField =
      assertRevocationAttribute(key, value) || sawRevocationField;
  }
  if (!sawRevocationField) {
    throw new ForbiddenError('accountSession client writes are revoke-only');
  }
}

/**
 * Clients may only push **revocation** patches for their own device session row
 * (same shape as {@link clearAllActiveSessions} in session-service). Everything
 * else stays server-only (claim handler uses system context).
 */
export async function assertAccountSessionClientRevokeOnly(args: {
  deviceId: string;
  accountId: string;
  patch: PatchInput;
  tx: SqlClient;
}): Promise<void> {
  const { deviceId, accountId, patch, tx } = args;
  const rows = await tx.query<{ attributes: unknown }>(
    'SELECT attributes FROM snapshots WHERE entity_id = ? AND entity_type = ?',
    [patch.entityId, ACCOUNT_SESSION_ENTITY_TYPE]
  );
  if (rows.length === 0) {
    throw new ForbiddenError('accountSession client writes are revoke-only');
  }
  const snap = parseSnapshotAttributes(rows[0]?.attributes);
  assertSessionScope(snap, deviceId, accountId);
  assertRevocationShape(patch);
}
