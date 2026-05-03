import { assert } from '@gamezilla/lib/assert';
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { PatchDb } from '../interface';
import { OPEN_PATCHES_DB_CONTEXT } from '../interface';
import { PATCH_DB_SYSTEM_PRINCIPAL_ID } from '../policy/system-principal';
import { createSqliteFactory } from './test-helpers';

const WIDGET_ENTITY_TYPE = 'widget';
const WIDGET_ID_ATTR = 'widget/id';
const WIDGET_NAME_ATTR = 'widget/displayName';

describe('compaction (sqlite)', () => {
  let db: PatchDb;
  let teardown: () => Promise<void>;

  beforeEach(async () => {
    const r = await createSqliteFactory();
    db = r.db;
    teardown = r.teardown;
  });

  afterEach(async () => {
    await teardown();
  });

  test('compactEntity merges oldest patches and sets patch/compacted', async () => {
    const entityId = '00000000-0000-4000-8000-00000000cafe';
    for (let i = 0; i < 5; i++) {
      await db.write([
        {
          entityId,
          entityType: WIDGET_ENTITY_TYPE,
          attributes: {
            [WIDGET_ID_ATTR]: entityId,
            [WIDGET_NAME_ATTR]: `v${i}`,
            'patch/createdBy': PATCH_DB_SYSTEM_PRINCIPAL_ID,
          },
        },
      ]);
    }
    const [before] = await db.read([
      { entityType: WIDGET_ENTITY_TYPE, entityId },
    ]);
    assert.defined(before, 'before');
    expect(before.patches.length).toBe(5);

    const compacted = await db.compaction.compactEntity(
      { entityId, entityType: WIDGET_ENTITY_TYPE },
      { keepLatest: 2 },
      OPEN_PATCHES_DB_CONTEXT
    );
    expect(compacted.removedPatchIds.length).toBe(3);
    expect(compacted.compactionPatchId).not.toBeNull();

    const [after] = await db.read([
      { entityType: WIDGET_ENTITY_TYPE, entityId },
    ]);
    assert.defined(after, 'after');
    expect(after.patches.length).toBe(3);
    const compactPatch = after.patches.find(
      (p) => p.patchId === compacted.compactionPatchId
    );
    assert.defined(compactPatch, 'compact patch');
    expect(compactPatch.attributes['patch/compacted']).toBe('1');
    expect(after.entities[0]?.attributes[WIDGET_NAME_ATTR]).toBe('v4');
  });

  test('compactEntity noop when chain within keepLatest + 1', async () => {
    const entityId = '00000000-0000-4000-8000-00000000babe';
    for (let i = 0; i < 2; i++) {
      await db.write([
        {
          entityId,
          entityType: WIDGET_ENTITY_TYPE,
          attributes: {
            [WIDGET_ID_ATTR]: entityId,
            [WIDGET_NAME_ATTR]: `x${i}`,
            'patch/createdBy': PATCH_DB_SYSTEM_PRINCIPAL_ID,
          },
        },
      ]);
    }
    const r = await db.compaction.compactEntity(
      { entityId, entityType: WIDGET_ENTITY_TYPE },
      { keepLatest: 2 },
      OPEN_PATCHES_DB_CONTEXT
    );
    expect(r.removedPatchIds).toHaveLength(0);
    expect(r.compactionPatchId).toBeNull();
  });
});
