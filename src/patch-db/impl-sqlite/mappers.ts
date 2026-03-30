import { Assert, assert } from '../../@shared/assert';
import {
  getPatchTopLevelFromAttributes,
  isValidAttribute,
  type Entity,
  type Patch,
} from '../interface';
import type { PatchRow, SnapshotRow } from './types';

/** Filters attributes to valid namespaced keys. Drops stale keys (e.g. pre-migration "completed" vs "todo/completed"). */
function filterValidAttributes(
  attrs: Record<string, unknown>
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(attrs)) {
    if (isValidAttribute(key)) out[key] = value;
  }
  return out;
}

/** Parses attributes JSON with contextual error on failure. Use at DB read boundary. */
export function parseAttributes(
  json: string,
  context: Record<string, unknown>,
  a: Assert = assert
): Record<string, unknown> {
  try {
    const parsed = JSON.parse(json);
    a.record(parsed, 'attributes must parse to object');
    return parsed;
  } catch (err) {
    a.ok(false, 'Invalid JSON in attributes', {
      ...context,
      raw: json,
      parseError: err,
    });
  }
}

export function toPatch(row: PatchRow): Patch {
  const raw = parseAttributes(row.attributes, {
    entity_id: row.entity_id,
    entity_type: row.entity_type,
    patch_id: row.patch_id,
  });
  const attrs = filterValidAttributes(raw);
  const { createdBy, sessionId } = getPatchTopLevelFromAttributes(attrs);
  return {
    patchId: row.patch_id,
    entityId: row.entity_id,
    entityType: row.entity_type,
    attributes: attrs,
    createdAt: row.created_at,
    recordedAt: row.recorded_at,
    parentId: row.parent_id ?? null,
    createdBy,
    sessionId,
  };
}

export function toEntity(row: SnapshotRow): Entity {
  const raw = parseAttributes(row.attributes, {
    entity_id: row.entity_id,
    entity_type: row.entity_type,
  });
  const attrs = filterValidAttributes(raw);
  return {
    entityId: row.entity_id,
    entityType: row.entity_type,
    attributes: attrs,
  };
}
