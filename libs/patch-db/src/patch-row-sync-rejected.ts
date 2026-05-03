import { parseAttributes } from './impl-sqlite/mappers';
import type { PatchRow } from './impl-sqlite/types';
import { isSyncRejectedPatchAttributes } from './metadata/patch-metadata';

export function patchRowIsSyncRejected(
  row: Pick<PatchRow, 'attributes' | 'entity_id' | 'entity_type' | 'patch_id'>
): boolean {
  const attrs = parseAttributes(row.attributes, {
    entity_id: row.entity_id,
    entity_type: row.entity_type,
    patch_id: row.patch_id,
  });
  return isSyncRejectedPatchAttributes(attrs);
}
