import { expect, test } from 'bun:test';
import {
  decodeNumberlinkDefinition,
  decodeNumberlinkDraft,
  encodeNumberlinkDefinition,
  validateNumberlinkDefinition,
} from '@libs/numberlink-shared-ts/numberlink-definition';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { rowBoard, TWO_ROWS } from './numberlink-fixtures';

test('rectangular endpoint definitions round-trip without losing rule options or pair identity', () => {
  assertProperty(
    'definition round trip',
    fc.property(
      fc.integer({ min: 2, max: 20 }),
      fc.integer({ min: 2, max: 20 }),
      fc.constantFrom('all' as const, 'pairs' as const),
      (width, height, coverage) => {
        const definition = { ...rowBoard(width, height).definition, coverage };
        expect(validateNumberlinkDefinition(definition).valid).toBe(true);
        expect(
          decodeNumberlinkDefinition(encodeNumberlinkDefinition(definition))
        ).toEqual({ valid: true, value: definition });
      }
    )
  );
});

test('malformed dimensions, endpoint cardinality, identity and occupancy are refused', () => {
  assertProperty(
    'invalid dimensions',
    fc.property(
      fc.oneof(
        fc.integer({ max: 1 }),
        fc.integer({ min: 21 }),
        fc.double({ noInteger: true })
      ),
      (width) =>
        expect(validateNumberlinkDefinition({ ...TWO_ROWS, width }).valid).toBe(
          false
        )
    )
  );
  const pair = TWO_ROWS.pairs[0]!;
  const invalid = [
    { ...TWO_ROWS, pairs: [] },
    { ...TWO_ROWS, coverage: undefined },
    { ...TWO_ROWS, pairs: [pair, pair] },
    { ...TWO_ROWS, pairs: [{ ...pair, endpoints: [pair.endpoints[0]] }] },
    {
      ...TWO_ROWS,
      pairs: [{ ...pair, endpoints: [pair.endpoints[0], pair.endpoints[0]] }],
    },
    {
      ...TWO_ROWS,
      pairs: [{ ...pair, endpoints: [{ x: 3, y: 0 }, pair.endpoints[1]] }],
    },
    { ...TWO_ROWS, pairs: [{ ...pair, label: ' ' }] },
    { ...TWO_ROWS, pairs: [{ ...pair, color: 'invisible' }] },
  ];
  for (const value of invalid)
    expect(validateNumberlinkDefinition(value).valid).toBe(false);
});

test('arbitrary external data never escapes either decoder as an exception', () => {
  assertProperty(
    'external definitions are untrusted',
    fc.property(fc.jsonValue(), (input) => {
      expect(() => validateNumberlinkDefinition(input)).not.toThrow();
      expect(() =>
        decodeNumberlinkDefinition(JSON.stringify(input))
      ).not.toThrow();
      expect(() => decodeNumberlinkDraft(JSON.stringify(input))).not.toThrow();
    })
  );
  expect(decodeNumberlinkDefinition('{')).toMatchObject({ valid: false });
});

test('unfinished authoring content is readable without being accepted for play', () => {
  const empty = { ...TWO_ROWS, pairs: [] };
  expect(decodeNumberlinkDraft(JSON.stringify(empty))).toEqual({
    valid: true,
    value: empty,
  });
  expect(decodeNumberlinkDefinition(JSON.stringify(empty)).valid).toBe(false);
  const unfinished = {
    ...TWO_ROWS,
    pairs: TWO_ROWS.pairs.map((pair) => ({ ...pair, label: '' })),
  };
  expect(decodeNumberlinkDraft(JSON.stringify(unfinished))).toEqual({
    valid: true,
    value: unfinished,
  });
  expect(decodeNumberlinkDefinition(JSON.stringify(unfinished)).valid).toBe(
    false
  );
});
