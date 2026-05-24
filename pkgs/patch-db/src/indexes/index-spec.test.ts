import { assert } from '@pkgs/assert';
import { asKeyword, type Keyword } from '@pkgs/keyword';
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import {
  normalizeIndexSpec,
  normalizeIndexSpecs,
  PATCH_DB_INDEX_NAME_PREFIX,
  type PatchDbIndexSpec,
} from './index-spec';

/** Node crash handler calls `process.exit`; register one that throws so tests can assert failures. */
function registerThrowingCrashHandlerForTests(): () => void {
  return assert.registerCrashHandler({
    priority: 5,
    match: () => true,
    crash(message, context) {
      const err = new Error(message);
      Object.assign(err, { context });
      throw err;
    },
  });
}

let disposeCrash: () => void;
beforeAll(() => {
  disposeCrash = registerThrowingCrashHandlerForTests();
});
afterAll(() => {
  disposeCrash();
});

describe('normalizeIndexSpec', () => {
  test('extracts .key from AttributeTag-like refs', () => {
    const tag = { key: asKeyword('space/host-id') };
    const out = normalizeIndexSpec({
      name: 'space-host',
      entityType: 'space',
      fields: [{ kind: 'attribute', attribute: tag }],
    });
    expect(out.fields[0]).toEqual({
      kind: 'attribute',
      attribute: asKeyword('space/host-id'),
      dataType: null,
    });
  });

  test('accepts raw keyword strings as attributes', () => {
    const out = normalizeIndexSpec({
      name: 'space-host',
      entityType: 'space',
      fields: [{ kind: 'attribute', attribute: asKeyword('space/host-id') }],
    });
    expect(out.fields[0]).toEqual({
      kind: 'attribute',
      attribute: asKeyword('space/host-id'),
      dataType: null,
    });
  });

  test('preserves dataType for numeric attributes (drives ::numeric cast)', () => {
    const out = normalizeIndexSpec({
      name: 'puzzle-rating',
      entityType: 'chess.puzzle',
      fields: [
        {
          kind: 'attribute',
          attribute: asKeyword('chess.puzzle/rating'),
          dataType: 'integer',
        },
      ],
    });
    expect(out.fields[0]).toEqual({
      kind: 'attribute',
      attribute: asKeyword('chess.puzzle/rating'),
      dataType: 'integer',
    });
  });

  test('dataType is part of the dbName hash so cast-form changes orphan old', () => {
    const text = normalizeIndexSpec({
      name: 'rating',
      entityType: 'chess.puzzle',
      fields: [
        { kind: 'attribute', attribute: asKeyword('chess.puzzle/rating') },
      ],
    });
    const numeric = normalizeIndexSpec({
      name: 'rating',
      entityType: 'chess.puzzle',
      fields: [
        {
          kind: 'attribute',
          attribute: asKeyword('chess.puzzle/rating'),
          dataType: 'integer',
        },
      ],
    });
    expect(text.dbName).not.toBe(numeric.dbName);
  });

  test('emits deterministic dbName with content hash', () => {
    const a = normalizeIndexSpec({
      name: 'space-host',
      entityType: 'space',
      fields: [{ kind: 'attribute', attribute: asKeyword('space/host-id') }],
    });
    const b = normalizeIndexSpec({
      name: 'space-host',
      entityType: 'space',
      fields: [{ kind: 'attribute', attribute: asKeyword('space/host-id') }],
    });
    expect(a.dbName).toBe(b.dbName);
    expect(a.dbName.startsWith(PATCH_DB_INDEX_NAME_PREFIX)).toBe(true);
    expect(a.dbName.includes('space__space_host__')).toBe(true);
  });

  test('different content yields different dbName (drift -> orphan + create)', () => {
    const a = normalizeIndexSpec({
      name: 'space-host',
      entityType: 'space',
      fields: [{ kind: 'attribute', attribute: asKeyword('space/host-id') }],
    });
    const b = normalizeIndexSpec({
      name: 'space-host',
      entityType: 'space',
      fields: [{ kind: 'attribute', attribute: asKeyword('space/title') }],
    });
    expect(a.dbName).not.toBe(b.dbName);
  });

  test('slugifies dot-namespaced entity types', () => {
    const out = normalizeIndexSpec({
      name: 'mship-active',
      entityType: 'space.membership',
      fields: [{ kind: 'entityType' }, { kind: 'entityId' }],
      where: [
        {
          kind: 'attributeAbsent',
          attribute: asKeyword('space.membership/left-at'),
        },
      ],
    });
    expect(out.dbName.includes('space_membership__mship_active__')).toBe(true);
  });

  test('rejects malformed local names', () => {
    expect(() =>
      normalizeIndexSpec({
        name: 'Bad Name!',
        entityType: 'space',
        fields: [{ kind: 'entityId' }],
      })
    ).toThrow();
  });

  test('rejects malformed entity types', () => {
    expect(() =>
      normalizeIndexSpec({
        name: 'x',
        entityType: 'NotKebab',
        fields: [{ kind: 'entityId' }],
      })
    ).toThrow();
  });

  test('rejects malformed attribute keys', () => {
    expect(() =>
      normalizeIndexSpec({
        name: 'x',
        entityType: 'space',
        fields: [
          {
            kind: 'attribute',
            attribute: 'no-namespace' as unknown as Keyword,
          },
        ],
      })
    ).toThrow();
  });

  test('rejects empty columns array', () => {
    expect(() =>
      normalizeIndexSpec({
        name: 'x',
        entityType: 'space',
        fields: [],
      })
    ).toThrow();
  });
});

describe('normalizeIndexSpecs', () => {
  test('rejects duplicate (entityType, localName) pairs', () => {
    const specs: PatchDbIndexSpec[] = [
      {
        name: 'host',
        entityType: 'space',
        fields: [{ kind: 'attribute', attribute: asKeyword('space/host-id') }],
      },
      {
        name: 'host',
        entityType: 'space',
        fields: [{ kind: 'attribute', attribute: asKeyword('space/title') }],
      },
    ];
    expect(() => normalizeIndexSpecs(specs)).toThrow();
  });

  test('allows same local name across different entity types', () => {
    const specs: PatchDbIndexSpec[] = [
      {
        name: 'lookup',
        entityType: 'space',
        fields: [{ kind: 'attribute', attribute: asKeyword('space/host-id') }],
      },
      {
        name: 'lookup',
        entityType: 'space.membership',
        fields: [
          {
            kind: 'attribute',
            attribute: asKeyword('space.membership/guest-id'),
          },
        ],
      },
    ];
    const out = normalizeIndexSpecs(specs);
    expect(out.length).toBe(2);
    expect(out[0]!.dbName).not.toBe(out[1]!.dbName);
  });
});
