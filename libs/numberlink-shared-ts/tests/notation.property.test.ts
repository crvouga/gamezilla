import { expect, test } from 'bun:test';
import {
  decodeNumberlinkDefinition,
  decodeNumberlinkDraft,
  encodeNumberlinkDefinition,
  validateNumberlinkDefinition,
} from '@libs/numberlink-shared-ts/numberlink-definition';
import {
  formatNumberlinkNotation,
  type NumberlinkNotation,
  numberlinkAsciiBoard,
  parseNumberlinkNotation,
} from '@libs/numberlink-shared-ts/numberlink-notation';
import {
  definitionOfNotation,
  notationOfDefinition,
} from '@libs/numberlink-shared-ts/numberlink-notation-definition';
import { numberlinkPuzzleContent } from '@libs/numberlink-shared-ts/numberlink-puzzle-content';
import { validateNumberlinkState } from '@libs/numberlink-shared-ts/numberlink-state';
import type { NumberlinkDefinition } from '@libs/numberlink-shared-ts/numberlink-types';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { TWO_ROWS } from './numberlink-fixtures';

function parsed(text: string): NumberlinkNotation {
  const result = parseNumberlinkNotation(text);
  if (!result.valid) throw new Error(result.issues[0]?.message);
  return result.value;
}

function refusal(text: string): string | undefined {
  const result = parseNumberlinkNotation(text);
  return result.valid ? undefined : result.issues[0]?.code;
}

/** Endpoint geometry alone: pair ids, labels and colors are not a board's notation. */
function geometry(definition: NumberlinkDefinition) {
  return {
    size: [definition.width, definition.height],
    coverage: definition.coverage,
    pairs: definition.pairs
      .map((pair) =>
        pair.endpoints
          .map((cell) => cell.y * definition.width + cell.x)
          .sort((a, b) => a - b)
      )
      .sort((a, b) => a[0]! - b[0]!),
  };
}

const boardArb = fc
  .record({
    width: fc.integer({ min: 2, max: 20 }),
    height: fc.integer({ min: 2, max: 20 }),
    coverage: fc.constantFrom('all' as const, 'pairs' as const),
  })
  .chain(({ width, height, coverage }) =>
    fc
      .uniqueArray(fc.integer({ min: 0, max: width * height - 1 }), {
        minLength: 2,
        maxLength: Math.min(104, width * height),
      })
      .map((cells): NumberlinkDefinition => {
        const even = cells.slice(0, cells.length - (cells.length % 2));
        const at = (index: number) => ({
          x: index % width,
          y: Math.floor(index / width),
        });
        return {
          format: 1,
          width,
          height,
          coverage,
          pairs: Array.from({ length: even.length / 2 }, (_, pair) => ({
            id: `pair-${pair}`,
            label: String(pair + 1),
            color: 'blue',
            endpoints: [at(even[pair * 2]!), at(even[pair * 2 + 1]!)],
          })),
        };
      })
  );

test('a worked example: the notation, its ASCII board and its playable definition', () => {
  const text = 'NL1:A3B/2C1D/5/B1C2/A2D1';
  const notation = parsed(text);
  expect(numberlinkAsciiBoard(notation)).toBe(
    ['A...B', '..C.D', '.....', 'B.C..', 'A..D.'].join('\n')
  );
  expect(formatNumberlinkNotation(notation)).toBe(text);
  expect(definitionOfNotation(notation)).toEqual({
    valid: true,
    value: {
      format: 1,
      width: 5,
      height: 5,
      coverage: 'all',
      pairs: [
        {
          id: 'A',
          label: '1',
          color: 'red',
          endpoints: [
            { x: 0, y: 0 },
            { x: 0, y: 4 },
          ],
        },
        {
          id: 'B',
          label: '2',
          color: 'orange',
          endpoints: [
            { x: 4, y: 0 },
            { x: 0, y: 3 },
          ],
        },
        {
          id: 'C',
          label: '3',
          color: 'yellow',
          endpoints: [
            { x: 2, y: 1 },
            { x: 2, y: 3 },
          ],
        },
        {
          id: 'D',
          label: '4',
          color: 'green',
          endpoints: [
            { x: 4, y: 1 },
            { x: 3, y: 4 },
          ],
        },
      ],
    },
  });
});

test('every board within bounds has one spelling that round-trips', () => {
  assertProperty(
    'notation round trip',
    fc.property(boardArb, (definition) => {
      const notation = notationOfDefinition(definition);
      if (!notation.valid) throw new Error('representable board refused');
      const text = formatNumberlinkNotation(notation.value);
      expect(parsed(text)).toEqual(notation.value);
      expect(formatNumberlinkNotation(parsed(text))).toBe(text);
      const decoded = decodeNumberlinkDefinition(text);
      if (!decoded.valid) throw new Error('notation definition refused');
      expect(geometry(decoded.value)).toEqual(geometry(definition));
    })
  );
});

test('the grammar and its bounds are strict', () => {
  const full = (rows: number, row: string) =>
    `NL1:${Array.from({ length: rows }, (_, index) => (index === 0 ? row : '20')).join('/')}`;
  expect(refusal(full(20, 'A18A'))).toBeUndefined();
  expect(refusal('NL1:AA/2')).toBeUndefined();
  for (const [text, code] of [
    ['NL1:A1A', 'notation_bounds'],
    [full(21, 'A18A'), 'notation_bounds'],
    ['NL1:A/A', 'notation_bounds'],
    ['NL1:A19A/21', 'notation_bounds'],
    ['NL1:A1A/3/', 'notation_bounds'],
    ['NL1:A1A/4', 'notation_bounds'],
    [`NL1:A1A/3;x=${'a'.repeat(2048)}`, 'notation_bounds'],
    ['NL1:A0A/2', 'notation_syntax'],
    ['NL1:A01A/3', 'notation_syntax'],
    ['NL1:A.A/3', 'notation_syntax'],
    ['NL1 A1A/3', 'notation_syntax'],
    ['nl1:A1A/3', 'notation_syntax'],
    ['NL2:A1A/3', 'notation_version'],
    ['NL10:A1A/3', 'notation_version'],
    ['NL1:B1B/3', 'notation_pairs'],
    ['NL1:B1A/A1B', 'notation_pairs'],
    ['NL1:A1A/1A1', 'notation_pairs'],
    ['NL1:A2/3', 'notation_pairs'],
    ['NL1:3/3', 'notation_pairs'],
    ['NL1:A1A/3;cover=all', 'notation_record'],
    ['NL1:A1A/3;cover=most', 'notation_record'],
    ['NL1:A1A/3;players=5', 'notation_record'],
    ['NL1:A1A/3;bridge=A1', 'notation_record'],
    ['NL1:A1A/3;bridge=D1', 'notation_record'],
    ['NL1:A1A/3;bridge=B2,B2', 'notation_record'],
    ['NL1:A1A/3;teleport=B2', 'notation_record'],
    ['NL1:A1A/3;teleport=B2,B2', 'notation_record'],
    ['NL1:A1A/3;item=B2', 'notation_record'],
    ['NL1:A1A/3;cover=pairs;cover=pairs', 'notation_record'],
    ['NL1:A1A/3;', 'notation_record'],
    ['NL1:A1A/3;Zip=B2', 'notation_record'],
    ['NL1:A1A/3;zip=B 2', 'notation_record'],
    [`NL1:A1A/3;zip=${'1'.repeat(257)}`, 'notation_record'],
    [
      `NL1:A1A/3;${Array.from({ length: 17 }, (_, index) => `x${String(index).padStart(2, '0')}=1`).join(';')}`,
      'notation_record',
    ],
  ] as const)
    expect({ text: text.slice(0, 60), code: refusal(text) }).toEqual({
      text: text.slice(0, 60),
      code,
    });
});

test('untrusted text is refused without throwing', () => {
  assertProperty(
    'notation never throws',
    fc.property(
      fc.oneof(
        fc.string(),
        fc.string().map((tail) => `NL1:${tail}`),
        fc
          .stringMatching(/^[A-Da-d0-9/;=,@.-]{0,40}$/)
          .map((tail) => `NL1:${tail}`)
      ),
      (text) => {
        expect(() => parseNumberlinkNotation(text)).not.toThrow();
        expect(() => decodeNumberlinkDefinition(text)).not.toThrow();
        expect(() => decodeNumberlinkDraft(text)).not.toThrow();
        const result = parseNumberlinkNotation(text);
        if (result.valid)
          expect(
            parseNumberlinkNotation(formatNumberlinkNotation(result.value))
          ).toEqual(result);
      }
    )
  );
});

test('future records are typed, preserved and safely refused by the rules', () => {
  const text =
    'NL1:A1B/3/B1A;bridge=B2;item=key@A2,gem@C2;players=2;teleport=B1,B3;zip.line=A2-C2';
  const notation = parsed(text);
  expect(notation.records).toEqual([
    { kind: 'bridge', cells: [{ x: 1, y: 1 }] },
    {
      kind: 'item',
      items: [
        { kind: 'key', cell: { x: 0, y: 1 } },
        { kind: 'gem', cell: { x: 2, y: 1 } },
      ],
    },
    { kind: 'players', count: 2 },
    {
      kind: 'teleport',
      links: [
        [
          { x: 1, y: 0 },
          { x: 1, y: 2 },
        ],
      ],
    },
    { kind: 'unknown', tag: 'zip.line', value: 'A2-C2' },
  ]);
  expect(formatNumberlinkNotation(notation)).toBe(text);
  // Record order carries no meaning; the writer puts names in ASCII order.
  expect(
    formatNumberlinkNotation(
      parsed(
        'NL1:A1B/3/B1A;zip.line=A2-C2;teleport=B1,B3;players=2;item=key@A2,gem@C2;bridge=B2'
      )
    )
  ).toBe(text);
  expect(numberlinkAsciiBoard(notation)).toBe(
    [
      'A@B',
      '*+*',
      'B@A',
      'bridge=B2',
      'item=key@A2,gem@C2',
      'players=2',
      'teleport=B1,B3',
      'zip.line=A2-C2',
    ].join('\n')
  );
  for (const [record, named] of [
    ['bridge=B2', 'bridges'],
    ['item=key@B2', 'items to collect'],
    ['players=2', 'more than one player'],
    ['teleport=B1,B3', 'teleporters'],
    ['zip.line=A2-C2', 'a rule (zip.line)'],
  ] as const) {
    const board = `NL1:A1B/3/B1A;${record}`;
    expect(numberlinkPuzzleContent.rules.validateDefinition(board)).toEqual({
      valid: false,
      issues: [
        {
          code: 'unsupported_mechanic',
          message: `This puzzle uses ${named}, which this version of Numberlink cannot play. Update the app or choose another puzzle.`,
        },
      ],
    });
    expect(numberlinkPuzzleContent.rules.initial(board)).toMatchObject({
      accepted: false,
    });
    expect(decodeNumberlinkDraft(board).valid).toBe(false);
  }
});

test('legacy JSON definitions keep playing and convert to notation by geometry', () => {
  const legacy = encodeNumberlinkDefinition(TWO_ROWS);
  expect(decodeNumberlinkDefinition(legacy)).toEqual({
    valid: true,
    value: TWO_ROWS,
  });
  expect(numberlinkPuzzleContent.rules.validateDefinition(legacy)).toEqual({
    valid: true,
  });
  const notation = notationOfDefinition(TWO_ROWS);
  if (!notation.valid) throw new Error('legacy board refused');
  expect(formatNumberlinkNotation(notation.value)).toBe('NL1:A1A/B1B');
  const pairsOnly = notationOfDefinition({ ...TWO_ROWS, coverage: 'pairs' });
  if (!pairsOnly.valid) throw new Error('legacy board refused');
  const text = formatNumberlinkNotation(pairsOnly.value);
  expect(text).toBe('NL1:A1A/B1B;cover=pairs');
  const decoded = decodeNumberlinkDefinition(text);
  if (!decoded.valid) throw new Error('converted board refused');
  expect(geometry(decoded.value)).toEqual(
    geometry({ ...TWO_ROWS, coverage: 'pairs' })
  );
  expect(decodeNumberlinkDraft(text)).toEqual(decoded);
  const crowded = notationOfDefinition({
    ...TWO_ROWS,
    width: 20,
    height: 20,
    pairs: Array.from({ length: 53 }, (_, pair) => ({
      id: `pair-${pair}`,
      label: String(pair),
      color: 'red',
      endpoints: [
        { x: pair % 20, y: Math.floor(pair / 20) },
        { x: pair % 20, y: 10 + Math.floor(pair / 20) },
      ],
    })),
  });
  expect(crowded).toMatchObject({
    valid: false,
    issues: [{ code: 'notation_pairs' }],
  });
});

test('a validated board and its progress are frozen and never taken for each other', () => {
  const board = decodeNumberlinkDefinition('NL1:A1A/B1B');
  if (!board.valid) throw new Error('board refused');
  expect(Object.isFrozen(board.value.pairs[0]?.endpoints[0])).toBe(true);
  expect(validateNumberlinkState(board.value, board.value).valid).toBe(false);
  const progress = validateNumberlinkState(board.value, {
    paths: [{ pairId: 'A', cells: [{ x: 0, y: 0 }] }],
  });
  if (!progress.valid) throw new Error('progress refused');
  expect(Object.isFrozen(progress.value.paths[0]?.cells)).toBe(true);
  expect(validateNumberlinkDefinition(progress.value).valid).toBe(false);
  const other = decodeNumberlinkDefinition('NL1:1A/1A');
  if (!other.valid) throw new Error('board refused');
  expect(validateNumberlinkState(other.value, progress.value).valid).toBe(
    false
  );
});
