import { describe, expect, test } from 'bun:test';
import { PatchMetaAttr } from '../metadata/patch-metadata';
import { QTask } from '../test/query-test-attrs';
import { toEntity, toPatch } from './mappers';

describe('mappers', () => {
  test('toPatch filters invalid (stale) attribute keys', () => {
    const row = {
      patch_id: 'p1',
      entity_id: 'e1',
      entity_type: 'task',
      attributes: JSON.stringify({
        'task/title': 'valid',
        completed: 'stale-key', // pre-migration non-namespaced
        'patch/created-by-id': 'user',
        'patch/session-id': 's1',
      }),
      created_at: '2025-01-01T00:00:00Z',
      recorded_at: '2025-01-01T00:00:00Z',
      parent_id: null,
    };
    const patch = toPatch(row);
    expect(patch.attributes[QTask.title.key]).toBe('valid');
    expect(patch.attributes[PatchMetaAttr.createdById.key]).toBe('user');
    expect(patch.attributes[PatchMetaAttr.sessionId.key]).toBe('s1');
    expect(patch.attributes).not.toHaveProperty('completed');
  });

  test('toEntity filters invalid (stale) attribute keys', () => {
    const row = {
      entity_id: 'e1',
      entity_type: 'task',
      attributes: JSON.stringify({
        'task/title': 'valid',
        completed: true, // stale
      }),
    };
    const entity = toEntity(row);
    expect(entity.attributes[QTask.title.key]).toBe('valid');
    expect(entity.attributes).not.toHaveProperty('completed');
  });
});
