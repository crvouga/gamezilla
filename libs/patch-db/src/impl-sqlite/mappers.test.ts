import { describe, expect, test } from 'bun:test';
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
        'patch/createdById': 'user',
        'patch/sessionId': 's1',
      }),
      created_at: '2025-01-01T00:00:00Z',
      recorded_at: '2025-01-01T00:00:00Z',
      parent_id: null,
    };
    const patch = toPatch(row);
    expect(patch.attributes['task/title']).toBe('valid');
    expect(patch.attributes['patch/createdById']).toBe('user');
    expect(patch.attributes['patch/sessionId']).toBe('s1');
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
    expect(entity.attributes['task/title']).toBe('valid');
    expect(entity.attributes).not.toHaveProperty('completed');
  });
});
