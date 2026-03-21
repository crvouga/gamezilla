import { assertAttribute, type Entity, type Patch } from '../interface';
import type { PatchRow, SnapshotRow } from './types';

export function toPatch(row: PatchRow): Patch {
  const attrs = JSON.parse(row.attributes);
  for (const key of Object.keys(attrs)) {
    assertAttribute(key);
  }
  const createdBy = attrs['patch/createdBy'];
  const sessionId = attrs['patch/sessionId'];
  return {
    patchId: row.patch_id,
    entityId: row.entity_id,
    entityType: row.entity_type,
    attributes: attrs,
    createdAt: row.created_at,
    recordedAt: row.recorded_at,
    parentId: row.parent_id ?? null,
    createdBy: String(createdBy ?? ''),
    sessionId:
      sessionId !== null && sessionId !== undefined ? String(sessionId) : '',
  };
}

export function toEntity(row: SnapshotRow): Entity {
  const attrs = JSON.parse(row.attributes);
  for (const key of Object.keys(attrs)) {
    assertAttribute(key);
  }
  return {
    entityId: row.entity_id,
    entityType: row.entity_type,
    attributes: attrs,
  };
}
