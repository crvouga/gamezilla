import { describe, expect, it } from 'bun:test';

import {
  ACCOUNT_DB_PREFIX,
  accountDatabaseBasename,
  anonymousDatabaseBasename,
  flat32ToUuid,
  tryParseAccountDatabaseBasename,
  uuidToFlat32,
} from './account-db-paths';

const SAMPLE_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('account-db-paths', () => {
  it('roundtrips uuid through flat32 basename', () => {
    const base = accountDatabaseBasename(SAMPLE_UUID);
    expect(base).toBe(`${ACCOUNT_DB_PREFIX}${uuidToFlat32(SAMPLE_UUID)}`);
    const parsed = tryParseAccountDatabaseBasename(base);
    expect(parsed).toEqual({
      kind: 'account',
      id: SAMPLE_UUID,
      basename: base,
    });
  });

  it('parses anonymous basename', () => {
    const base = anonymousDatabaseBasename(SAMPLE_UUID);
    const parsed = tryParseAccountDatabaseBasename(base);
    expect(parsed?.kind).toBe('anonymous');
    expect(parsed?.id).toBe(SAMPLE_UUID);
  });

  it('flat32ToUuid rejects invalid', () => {
    expect(flat32ToUuid('gggggggggggggggggggggggggggggggg')).toBe(null);
  });

  it('returns null for unrelated basenames', () => {
    expect(tryParseAccountDatabaseBasename('main')).toBe(null);
  });
});
