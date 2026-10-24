import { expect, test } from 'bun:test';
import {
  applyNumberlinkAction,
  decodeNumberlinkState,
  encodeNumberlinkState,
  numberlinkComplete,
  validateNumberlinkState,
} from '@libs/numberlink-shared-ts/numberlink-state';
import type {
  Cell,
  NumberlinkState,
} from '@libs/numberlink-shared-ts/numberlink-types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { rowBoard, TWO_ROWS, TWO_ROWS_SOLUTION } from './numberlink-fixtures';

test('known row tilings conserve cells, survive codecs and accept either endpoint direction', () => {
  assertProperty(
    'complete row tilings',
    fc.property(
      fc.integer({ min: 2, max: 20 }),
      fc.integer({ min: 2, max: 20 }),
      (width, height) => {
        const { definition, solution } = rowBoard(width, height);
        expect(numberlinkComplete(definition, solution)).toBe(true);
        const reversed = {
          paths: solution.paths.map((path) => ({
            ...path,
            cells: [...path.cells].reverse(),
          })),
        };
        expect(numberlinkComplete(definition, reversed)).toBe(true);
        expect(
          decodeNumberlinkState(
            definition,
            encodeNumberlinkState(definition, reversed)
          )
        ).toEqual({ valid: true, value: reversed });
        for (const path of solution.paths) {
          const shortened = {
            paths: [
              ...solution.paths.filter((entry) => entry !== path),
              { ...path, cells: path.cells.slice(0, -1) },
            ],
          };
          expect(validateNumberlinkState(definition, shortened).valid).toBe(
            true
          );
          expect(numberlinkComplete(definition, shortened)).toBe(false);
        }
      }
    )
  );
});

test('arbitrary gestures preserve the input and every accepted path invariant', () => {
  const cell = fc.record({
    x: fc.integer({ min: -1, max: 3 }),
    y: fc.integer({ min: -1, max: 2 }),
  });
  assertProperty(
    'atomic gestures',
    fc.property(fc.array(cell, { maxLength: 10 }), (cells) => {
      const state: NumberlinkState = { paths: [TWO_ROWS_SOLUTION.paths[1]!] };
      const before = JSON.stringify(state);
      const result = applyNumberlinkAction(TWO_ROWS, state, {
        pairId: 'first',
        cells,
      });
      expect(JSON.stringify(state)).toBe(before);
      if (!result.valid) return;
      expect(
        result.value.paths.find((path) => path.pairId === 'second')
      ).toEqual(state.paths[0]);
      const path = result.value.paths.find((entry) => entry.pairId === 'first');
      if (path === undefined) {
        expect(cells).toEqual([]);
        return;
      }
      expect(path.cells[0]).toEqual(expect.objectContaining({ y: 0 }));
      expect([0, 2]).toContain(path.cells[0]!.x);
      expect(
        new Set(path.cells.map((point) => `${point.x}:${point.y}`)).size
      ).toBe(path.cells.length);
      path.cells.forEach((point, index) => {
        expect(point.y).toBe(0);
        expect(point.x).toBeGreaterThanOrEqual(0);
        expect(point.x).toBeLessThan(3);
        if (index > 0)
          expect(Math.abs(point.x - path.cells[index - 1]!.x)).toBe(1);
      });
    })
  );
});

test('path validation rejects disconnected, colliding, unpaired, repeated and overshooting coordinates', () => {
  const invalid: readonly (readonly Cell[])[] = [
    [{ x: 1, y: 0 }],
    [
      { x: 0, y: 0 },
      { x: 2, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 1 },
    ],
    [
      { x: 0, y: 0 },
      { x: 0, y: 1 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 0 },
    ],
    [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 1 },
    ],
  ];
  for (const cells of invalid)
    expect(
      applyNumberlinkAction(TWO_ROWS, { paths: [] }, { pairId: 'first', cells })
        .valid
    ).toBe(false);
  expect(
    validateNumberlinkState(TWO_ROWS, {
      paths: [TWO_ROWS_SOLUTION.paths[0], TWO_ROWS_SOLUTION.paths[0]],
    }).valid
  ).toBe(false);
  expect(
    applyNumberlinkAction(
      TWO_ROWS,
      { paths: [] },
      { pairId: 'missing', cells: [] }
    ).valid
  ).toBe(false);
  expect(numberlinkComplete(TWO_ROWS, { paths: [] })).toBe(false);
});

test('full coverage is a separate condition from joining all pairs', () => {
  const definition = { ...TWO_ROWS, height: 3 };
  expect(validateNumberlinkState(definition, TWO_ROWS_SOLUTION).valid).toBe(
    true
  );
  expect(numberlinkComplete(definition, TWO_ROWS_SOLUTION)).toBe(false);
  expect(
    numberlinkComplete({ ...definition, coverage: 'pairs' }, TWO_ROWS_SOLUTION)
  ).toBe(true);
});

test('state decoding validates external data before trusting paths or completion', () => {
  assertProperty(
    'untrusted state',
    fc.property(fc.jsonValue(), (input) => {
      expect(() => validateNumberlinkState(TWO_ROWS, input)).not.toThrow();
      expect(() =>
        decodeNumberlinkState(TWO_ROWS, JSON.stringify(input))
      ).not.toThrow();
    })
  );
  expect(decodeNumberlinkState(TWO_ROWS, 'broken')).toMatchObject({
    valid: false,
  });
});
