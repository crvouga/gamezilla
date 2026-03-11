import type { Entity, Patch, PatchInput } from '../interface';
import type { PatchRow, SnapshotRow } from './types';

export function toPatch(row: PatchRow): Patch {
  const meta = JSON.parse(row.metadata) as Record<string, unknown>;
  const { createdBy, sessionId, syncedAt, ...restMeta } = meta;
  return {
    patchId: row.patch_id,
    entityId: row.entity_id,
    entityType: row.entity_type,
    attributes: JSON.parse(row.attributes),
    createdAt: row.created_at,
    recordedAt: row.recorded_at,
    parentId: row.parent_id ?? null,
    createdBy: String(createdBy ?? ''),
    sessionId: sessionId != null ? String(sessionId) : '',
    meta: Object.keys(restMeta).length > 0 ? restMeta : undefined,
  };
}

export function toEntity(row: SnapshotRow): Entity {
  return {
    entityId: row.entity_id,
    entityType: row.entity_type,
    attributes: JSON.parse(row.attributes),
  };
}

export function toMetadata(patch: PatchInput): string {
  const meta = patch.meta ?? {};
  return JSON.stringify({
    createdBy: meta.createdBy ?? '',
    sessionId: meta.sessionId ?? '',
    syncedAt: null,
    ...meta,
  });
}
