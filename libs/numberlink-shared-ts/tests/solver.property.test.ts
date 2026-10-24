import { expect, test } from 'bun:test';
import { solveNumberlink } from '@libs/numberlink-shared-ts/numberlink-solver';
import { numberlinkComplete } from '@libs/numberlink-shared-ts/numberlink-state';
import type { NumberlinkDefinition } from '@libs/numberlink-shared-ts/numberlink-types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { oracleSolutions, rowBoard, TWO_ROWS } from './numberlink-fixtures';

test('bounded search agrees with exhaustive independent enumeration of small endpoint layouts', () => {
  assertProperty(
    'small board enumeration',
    fc.property(
      fc.shuffledSubarray([0, 1, 2, 3, 4, 5], { minLength: 4, maxLength: 4 }),
      fc.constantFrom('all' as const, 'pairs' as const),
      (endpoints, coverage) => {
        const cells = endpoints.map((index) => ({
          x: index % 3,
          y: Math.floor(index / 3),
        }));
        const definition: NumberlinkDefinition = {
          format: 1,
          width: 3,
          height: 2,
          coverage,
          pairs: [
            {
              id: 'first',
              label: '1',
              color: 'red',
              endpoints: [cells[0]!, cells[1]!],
            },
            {
              id: 'second',
              label: '2',
              color: 'green',
              endpoints: [cells[2]!, cells[3]!],
            },
          ],
        };
        const count = oracleSolutions(definition);
        const result = solveNumberlink(definition, { checkUniqueness: true });
        expect(result.status).toBe(count === 0 ? 'unsolvable' : 'solved');
        if (result.status !== 'solved') return;
        expect(numberlinkComplete(definition, result.solution)).toBe(true);
        expect(result.uniqueness).toBe(count === 1 ? 'unique' : 'multiple');
      }
    )
  );
});

test('search is deterministic and its witness satisfies the shared validator', () => {
  assertProperty(
    'solver witnesses',
    fc.property(
      fc.integer({ min: 2, max: 7 }),
      fc.integer({ min: 2, max: 7 }),
      (width, height) => {
        const { definition } = rowBoard(width, height);
        const before = JSON.stringify(definition);
        const result = solveNumberlink(definition);
        expect(solveNumberlink(definition)).toEqual(result);
        expect(JSON.stringify(definition)).toBe(before);
        expect(result.status).toBe('solved');
        if (result.status === 'solved')
          expect(numberlinkComplete(definition, result.solution)).toBe(true);
      }
    )
  );
});

test('search exhaustion cannot claim impossibility or uniqueness', () => {
  expect(solveNumberlink(TWO_ROWS, { maxNodes: 1 })).toEqual({
    status: 'inconclusive',
    nodes: 1,
  });
  const definition: NumberlinkDefinition = {
    format: 1,
    width: 3,
    height: 3,
    coverage: 'pairs',
    pairs: [
      {
        id: 'first',
        label: '1',
        color: 'red',
        endpoints: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
        ],
      },
    ],
  };
  expect(
    solveNumberlink(definition, { checkUniqueness: true, maxNodes: 3 })
  ).toMatchObject({ status: 'solved', uniqueness: 'unknown' });
  expect(solveNumberlink(definition, { checkUniqueness: true })).toMatchObject({
    status: 'solved',
    uniqueness: 'multiple',
  });
  expect(solveNumberlink({})).toMatchObject({ status: 'invalid' });
});
