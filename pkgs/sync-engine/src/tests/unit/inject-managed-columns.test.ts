import { describe, expect, test } from 'bun:test';
import { sql } from '@pkgs/sql';
import type { MutationEnv } from '../../mutations/core/types';
import { injectManagedColumns } from '../../mutations/shared/inject-managed-columns';

function testEnv(): MutationEnv {
  return {
    actorId: 'actor',
    deviceId: 'device',
    accountId: 'account',
    isAnon: false,
    now: () => new Date('2026-08-10T05:30:13.199Z'),
    createId: () => 'minted-id',
  };
}

describe('injectManagedColumns', () => {
  test('does not duplicate id/created_at already listed on INSERT', () => {
    const query = sql`
      INSERT INTO profiles (id, created_at, username, username_norm, avatar_config)
      VALUES (${'actor'}, ${'2026-08-10T05:30:13.199Z'}, ${''}, ${''}, ${'{}'})
      ON CONFLICT (id) DO NOTHING
    `;
    const out = injectManagedColumns(query, testEnv(), 'insert');
    expect(out.sql).toContain(
      '(id, created_at, username, username_norm, avatar_config, updated_at)'
    );
    expect(out.sql).not.toMatch(/\bid,\s*created_at,\s*id\b/);
    expect(out.values.at(-1)).toBe('2026-08-10T05:30:13.199Z');
  });

  test('injects missing managed columns when INSERT omits them', () => {
    const query = sql`
      INSERT INTO profiles (username, username_norm, avatar_config)
      VALUES (${'alice'}, ${'alice'}, ${'{}'})
    `;
    const out = injectManagedColumns(query, testEnv(), 'insert');
    expect(out.sql).toContain(
      '(username, username_norm, avatar_config, id, created_at, updated_at)'
    );
    expect(out.values.slice(-3)).toEqual([
      'minted-id',
      '2026-08-10T05:30:13.199Z',
      '2026-08-10T05:30:13.199Z',
    ]);
  });

  test('injects updated_at on UPDATE when absent', () => {
    const query = sql`
      UPDATE profiles SET username = ${'bob'} WHERE id = ${'actor'}
    `;
    const out = injectManagedColumns(query, testEnv(), 'update');
    expect(out.sql).toMatch(/SET\s+updated_at = \?/i);
    expect(out.values[0]).toBe('2026-08-10T05:30:13.199Z');
  });
});
