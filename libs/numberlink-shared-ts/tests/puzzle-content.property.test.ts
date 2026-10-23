import { expect, test } from 'bun:test';
import { encodeNumberlinkDefinition } from '@libs/numberlink-shared-ts/numberlink-definition';
import { numberlinkGameShared } from '@libs/numberlink-shared-ts/numberlink-game';
import { numberlinkPuzzleContent } from '@libs/numberlink-shared-ts/numberlink-puzzle-content';
import { encodeNumberlinkState } from '@libs/numberlink-shared-ts/numberlink-state';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { rowBoard, TWO_ROWS, TWO_ROWS_SOLUTION } from './numberlink-fixtures';

test('the opaque capability produces the same validated states and completion as Numberlink rules', () => {
  assertProperty(
    'opaque Numberlink states',
    fc.property(
      fc.integer({ min: 2, max: 8 }),
      fc.integer({ min: 2, max: 8 }),
      (width, height) => {
        const { definition, solution } = rowBoard(width, height);
        const encoded = encodeNumberlinkDefinition(definition);
        const initial = numberlinkPuzzleContent.rules.initial(encoded);
        expect(initial.accepted).toBe(true);
        if (!initial.accepted) throw new Error('valid definition refused');
        let state = initial.state;
        for (const path of solution.paths) {
          const changed = numberlinkPuzzleContent.rules.apply(
            encoded,
            state,
            JSON.stringify(path)
          );
          expect(changed.accepted).toBe(true);
          if (!changed.accepted) throw new Error('valid row path refused');
          state = changed.state;
          expect(
            numberlinkPuzzleContent.rules.validateState(encoded, state)
          ).toEqual({ valid: true });
        }
        expect(numberlinkPuzzleContent.rules.complete(encoded, state)).toBe(
          true
        );
        expect(
          numberlinkPuzzleContent.validatePublication?.(encoded, state)
        ).toEqual({ valid: true });
        expect(numberlinkPuzzleContent.statistics?.(encoded, state)).toEqual({
          connectedPairs: height,
          coveredCells: width * height,
        });
      }
    )
  );
});

test('publication requires a valid solved witness or a successful search using the same coverage rule', () => {
  const definition = encodeNumberlinkDefinition(TWO_ROWS);
  const solution = encodeNumberlinkState(TWO_ROWS, TWO_ROWS_SOLUTION);
  expect(
    numberlinkPuzzleContent.validatePublication?.(definition, solution)
  ).toEqual({ valid: true });
  expect(
    numberlinkPuzzleContent.validatePublication?.(definition, '{"paths":[]}')
  ).toMatchObject({ valid: false });
  expect(numberlinkPuzzleContent.validatePublication?.(definition)).toEqual({
    valid: true,
  });
  const impossible = encodeNumberlinkDefinition({
    format: 1,
    width: 2,
    height: 2,
    coverage: 'all',
    pairs: [
      {
        id: 'first',
        label: '1',
        color: 'red',
        endpoints: [
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ],
      },
    ],
  });
  expect(
    numberlinkPuzzleContent.validatePublication?.(impossible)
  ).toMatchObject({ valid: false, issues: [{ code: 'unsolvable' }] });
  const result = numberlinkPuzzleContent.solver?.solve(definition);
  expect(result?.status).toBe('solved');
  if (result?.status === 'solved')
    expect(
      numberlinkPuzzleContent.rules.complete(definition, result.state)
    ).toBe(true);
});

test('untrusted definitions, states and action encodings are refused through the public capability', () => {
  const definition = encodeNumberlinkDefinition(TWO_ROWS);
  const state = '{"paths":[]}';
  assertProperty(
    'opaque boundary validation',
    fc.property(fc.jsonValue(), (input) => {
      const text = JSON.stringify(input);
      expect(() =>
        numberlinkPuzzleContent.rules.validateDefinition(text)
      ).not.toThrow();
      expect(() => numberlinkPuzzleContent.rules.initial(text)).not.toThrow();
      expect(() =>
        numberlinkPuzzleContent.rules.validateState(definition, text)
      ).not.toThrow();
      expect(() =>
        numberlinkPuzzleContent.rules.apply(definition, state, text)
      ).not.toThrow();
      expect(() =>
        numberlinkPuzzleContent.rules.complete(definition, text)
      ).not.toThrow();
    })
  );
  expect(
    numberlinkPuzzleContent.rules.apply(definition, state, 'broken')
  ).toMatchObject({ accepted: false });
  expect(numberlinkPuzzleContent.rules.complete('broken', state)).toBe(false);
  expect(numberlinkGameShared.puzzleContent).toBe(numberlinkPuzzleContent);
  expect('turnGame' in numberlinkGameShared).toBe(false);
  expect('automation' in numberlinkGameShared).toBe(false);
});
