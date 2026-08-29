import { describe, expect, test } from 'bun:test';

import { parsePush } from '../../client/attach-push-bag';

describe('parsePush malformed unit', () => {
  test('non-object returns null', () => {
    expect(parsePush(null)).toBeNull();
    expect(parsePush('x')).toBeNull();
    expect(parsePush(1)).toBeNull();
  });

  test('missing or empty pushSeq returns null', () => {
    expect(parsePush({})).toBeNull();
    expect(parsePush({ pushSeq: '' })).toBeNull();
    expect(parsePush({ pushSeq: 1 })).toBeNull();
  });

  test('rows as array is dropped; non-object row entries skipped', () => {
    const withArrayRows = parsePush({
      pushSeq: '1',
      rows: [{ id: 'n1' }],
    });
    expect(withArrayRows).toEqual({ pushSeq: '1' });

    const mixed = parsePush({
      pushSeq: '2',
      tables: ['notes'],
      rows: {
        notes: [
          { id: 'good', body: 'ok' },
          'skip-me',
          null,
          [1, 2],
          { id: 'also-good', body: 'y' },
        ],
        bad: 'not-array',
      },
    });
    expect(mixed).toEqual({
      pushSeq: '2',
      tables: ['notes'],
      rows: {
        notes: [
          { id: 'good', body: 'ok' },
          { id: 'also-good', body: 'y' },
        ],
      },
    });
  });

  test('never throws on garbage shapes', () => {
    expect(() => parsePush(undefined)).not.toThrow();
    expect(() =>
      parsePush({ pushSeq: 'x', tables: [1, null, 'notes'], rows: null })
    ).not.toThrow();
    expect(
      parsePush({ pushSeq: 'x', tables: [1, null, 'notes'], rows: null })
    ).toEqual({
      pushSeq: 'x',
      tables: ['notes'],
    });
  });
});
