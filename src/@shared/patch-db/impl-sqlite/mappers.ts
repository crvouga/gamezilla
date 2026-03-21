import type { Entity, Patch } from '../interface';
import type { PatchRow, SnapshotRow } from './types';

const PATCH_META_KEYS = ['patch/createdBy', 'patch/sessionId', 'patch/syncedAt'];

function attributesWithoutPatchMeta(attrs: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (!PATCH_META_KEYS.includes(key)) {
      result[key] = value;
    }
  }
  return result;
}

export function toPatch(row: PatchRow): Patch {
  const attrs = JSON.parse(row.attributes) as Record<string, unknown>;
  const createdBy = attrs['patch/createdBy'];
  const sessionId = attrs['patch/sessionId'];
  const otherMetaKeys = Object.keys(attrs).filter(
    (k) => k.startsWith('patch/') && !PATCH_META_KEYS.includes(k)
  );
  const meta =
    otherMetaKeys.length > 0
      ? Object.fromEntries(
          otherMetaKeys.map((k) => [k.replace(/^patch\//, ''), attrs[k]])
        )
      : undefined;
  return {
    patchId: row.patch_id,
    entityId: row.entity_id,
    entityType: row.entity_type,
    attributes: attributesWithoutPatchMeta(attrs),
    createdAt: row.created_at,
    recordedAt: row.recorded_at,
    parentId: row.parent_id ?? null,
    createdBy: String(createdBy ?? ''),
    sessionId: (sessionId !== null && sessionId !== undefined) ? String(sessionId) : '',
    ...(meta !== undefined ? { meta } : {}),
  };
}

export function toEntity(row: SnapshotRow): Entity {
  return {
    entityId: row.entity_id,
    entityType: row.entity_type,
    attributes: JSON.parse(row.attributes),
  };
}
