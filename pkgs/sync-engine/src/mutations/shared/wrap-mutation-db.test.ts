import { describe, expect, test } from 'bun:test';
import { ident, sql } from '@pkgs/sql';

import { MutationError } from '../core/types';
import { assertNoDomainHardDelete, wrapMutationDb } from './wrap-mutation-db';

describe('wrapMutationDb', () => {
  test('allows soft-delete UPDATE', () => {
    expect(() =>
      assertNoDomainHardDelete(sql`
        UPDATE notes SET _deleted_at = ${'2026-01-01'} WHERE id = ${'n1'}
      `)
    ).not.toThrow();
  });

  test('rejects domain DELETE FROM', () => {
    expect(() =>
      assertNoDomainHardDelete(sql`
        DELETE FROM notes WHERE id = ${'n1'}
      `)
    ).toThrow(MutationError);
  });

  test('rejects DELETE FROM with ident()', () => {
    expect(() =>
      assertNoDomainHardDelete(sql`
        DELETE FROM ${ident('friendships')} WHERE id = ${'f1'}
      `)
    ).toThrow(MutationError);
  });

  test('allows framework DELETE FROM', () => {
    expect(() =>
      assertNoDomainHardDelete(sql`
        DELETE FROM _mutations WHERE seq <= ${1}
      `)
    ).not.toThrow();
  });

  test('wrapMutationDb blocks run', async () => {
    const calls: string[] = [];
    const wrapped = wrapMutationDb({
      query: async () => [],
      run: async () => {
        calls.push('run');
        return { changes: 0, lastInsertRowid: 0 };
      },
    });
    try {
      await wrapped.run(sql`DELETE FROM notes WHERE id = ${'n1'}`);
      expect.unreachable('expected NO_HARD_DELETE');
    } catch (error) {
      expect(error).toBeInstanceOf(MutationError);
      expect((error as MutationError).code).toBe('NO_HARD_DELETE');
    }
    expect(calls).toEqual([]);
    await wrapped.run(sql`UPDATE notes SET body = ${'x'} WHERE id = ${'n1'}`);
    expect(calls).toEqual(['run']);
  });
});
