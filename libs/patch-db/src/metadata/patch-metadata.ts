/**
 * Canonical attribute keys for patch metadata. These are stored in the
 * patch attributes JSON but excluded from entity snapshots by
 * implementations (via {@link PATCH_META_KEYS}).
 */

export const PATCH_CREATED_BY = 'patch/createdBy' as const;
export const PATCH_SESSION_ID = 'patch/sessionId' as const;
export const PATCH_SYNCED_AT = 'patch/syncedAt' as const;
export const PATCH_SYNC_REJECTED_AT = 'patch/syncRejectedAt' as const;
export const PATCH_SYNC_REJECTED_REASON = 'patch/syncRejectedReason' as const;
/** When true, this patch is treated as rejected for sync/outbox and entity materialization. */
export const PATCH_REJECTED = 'patch/rejected' as const;
export const PATCH_LAST_MODIFIED_BY_DEVICE =
  'patch/lastModifiedByDeviceId' as const;
export const PATCH_LAST_MODIFIED_BY_DEVICE_TIMESTAMP =
  'patch/lastModifiedByDeviceTimestamp' as const;
export const PATCH_LAST_MODIFIED_BY_ACCOUNT =
  'patch/lastModifiedByAccountId' as const;
export const PATCH_LAST_MODIFIED_BY_ACCOUNT_TIMESTAMP =
  'patch/lastModifiedByAccountTimestamp' as const;
export const PATCH_LAST_MODIFIED_BY_ACCOUNT_SESSION =
  'patch/lastModifiedByAccountSessionId' as const;
export const PATCH_LAST_MODIFIED_BY_ACCOUNT_SESSION_TIMESTAMP =
  'patch/lastModifiedByAccountSessionTimestamp' as const;
export const PATCH_LAST_MODIFIED_BY_CLIENT =
  'patch/lastModifiedByClientId' as const;
export const PATCH_LAST_MODIFIED_BY_CLIENT_TIMESTAMP =
  'patch/lastModifiedByClientTimestamp' as const;
export const PATCH_LAST_MODIFIED_AT = 'patch/lastModifiedAt' as const;

/**
 * Attribute keys treated as patch-level metadata by the library.
 * Implementations strip these from entity snapshots when merging patches.
 */
export const PATCH_META_KEYS: readonly string[] = [
  PATCH_CREATED_BY,
  PATCH_SESSION_ID,
  PATCH_SYNCED_AT,
  PATCH_SYNC_REJECTED_AT,
  PATCH_SYNC_REJECTED_REASON,
  PATCH_REJECTED,
  PATCH_LAST_MODIFIED_BY_DEVICE,
  PATCH_LAST_MODIFIED_BY_ACCOUNT,
  PATCH_LAST_MODIFIED_AT,
] as const;

/**
 * True when this patch must be ignored for entity snapshots and outbox push
 * (transport or partial write rejection, or explicit flag).
 */
export function isSyncRejectedPatchAttributes(
  attrs: Record<string, unknown>
): boolean {
  const rej = attrs[PATCH_REJECTED];
  if (rej === true || rej === 1) return true;
  const v = attrs[PATCH_SYNC_REJECTED_AT];
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === 'string') return v.length > 0;
  return true;
}
