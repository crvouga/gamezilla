/**
 * Canonical attribute keys for patch metadata. These are stored in the
 * patch attributes JSON but excluded from entity snapshots by
 * implementations (via {@link PATCH_META_KEYS}).
 */
import { createAttrNamespace } from '@gamezilla/attribute';

function readPatchString(v: unknown): string {
  return typeof v === 'string' ? v : String(v ?? '');
}

function readPatchUnknown(v: unknown): unknown {
  return v;
}

function readPatchBooleanish(v: unknown): boolean {
  return v === true || v === 1;
}

const patchMetaNs = createAttrNamespace('patch');

const patchRejectNs = createAttrNamespace('patch', 'reject');

function rejectCodeParse(_: unknown): true {
  return true;
}

/**
 * Machine rejection codes on the wire (`PatchRejectionReason.code`).
 * Keys are validated {@link Keyword}s under `patch.reject/*`.
 */
export const PATCH_REJECT_CODE = {
  forbidden: patchRejectNs('forbidden', rejectCodeParse),
  unknownEntityType: patchRejectNs('unknown-entity-type', rejectCodeParse),
  hook1: patchRejectNs('hook1', rejectCodeParse),
} as const;

/** Attribute tags from `@gamezilla/lib/attribute` — single source of truth for patch meta wire strings. */
export const PatchMetaAttr = {
  createdById: patchMetaNs('created-by-id', readPatchString),
  sessionId: patchMetaNs('session-id', readPatchString),
  syncedAt: patchMetaNs('synced-at', readPatchUnknown),
  syncRejectedAt: patchMetaNs('sync-rejected-at', readPatchUnknown),
  syncRejectedReason: patchMetaNs('sync-rejected-reason', readPatchUnknown),
  rejected: patchMetaNs('rejected', readPatchBooleanish),
} as const;

/** Original patch author id (account id when signed in, else install id). */
export const PATCH_CREATED_BY_ID = PatchMetaAttr.createdById.key;

export const PATCH_SESSION_ID = PatchMetaAttr.sessionId.key;

export const PATCH_SYNCED_AT = PatchMetaAttr.syncedAt.key;

export const PATCH_SYNC_REJECTED_AT = PatchMetaAttr.syncRejectedAt.key;

export const PATCH_SYNC_REJECTED_REASON = PatchMetaAttr.syncRejectedReason.key;

/** When true, this patch is treated as rejected for sync/outbox and entity materialization. */
export const PATCH_REJECTED = PatchMetaAttr.rejected.key;

/**
 * Attribute keys treated as patch-level metadata by the library.
 * Implementations strip these from entity snapshots when merging patches.
 */
export const PATCH_META_KEYS = [
  PatchMetaAttr.createdById.key,
  PatchMetaAttr.sessionId.key,
  PatchMetaAttr.syncedAt.key,
  PatchMetaAttr.syncRejectedAt.key,
  PatchMetaAttr.syncRejectedReason.key,
  PatchMetaAttr.rejected.key,
] as const;

function readBooleanish(v: unknown): boolean {
  return v === true || v === 1;
}

/**
 * True when this patch must be ignored for entity snapshots and outbox push
 * (transport or partial write rejection, or explicit flag).
 */
export function isSyncRejectedPatchAttributes(
  attrs: Readonly<Record<string, unknown>>
): boolean {
  const rej = attrs[PATCH_REJECTED];
  if (readBooleanish(rej)) return true;
  const v = attrs[PATCH_SYNC_REJECTED_AT];
  if (v === null || v === undefined || v === false) return false;
  if (typeof v === 'string') return v.length > 0;
  return true;
}
