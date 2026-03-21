import { assert } from '../../assert';
import { assertAttribute, type Entity, type Patch } from '../interface';
import type { PatchRow, SnapshotRow } from './types';

/** Parses attributes JSON with contextual error on failure. Use at DB read boundary. */
export function parseAttributes(
  json: string,
  context: Record<string, unknown>
): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json);
    assert(
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed),
      'attributes must parse to object',
      { ...context, parsed }
    );
    return parsed as Record<string, unknown>;
  } catch (err) {
    assert(false, 'Invalid JSON in attributes', { ...context, raw: json, parseError: err });
  }
}

export function toPatch(row: PatchRow): Patch {
  const attrs = parseAttributes(row.attributes, {
    entity_id: row.entity_id,
    entity_type: row.entity_type,
    patch_id: row.patch_id,
  });
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
  const attrs = parseAttributes(row.attributes, {
    entity_id: row.entity_id,
    entity_type: row.entity_type,
  });
  for (const key of Object.keys(attrs)) {
    assertAttribute(key);
  }
  return {
    entityId: row.entity_id,
    entityType: row.entity_type,
    attributes: attrs,
  };
}
