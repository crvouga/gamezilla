import {
  type NotationPair,
  type NumberlinkNotation,
  PAIR_LETTERS,
} from './numberlink-notation';
import type { NumberlinkRecord } from './numberlink-notation-records';
import {
  type Cell,
  type NumberlinkDefinition,
  PAIR_COLORS,
  type Validation,
} from './numberlink-types';

const MECHANICS: Readonly<Record<NumberlinkRecord['kind'], string>> = {
  bridge: 'bridges',
  cover: 'endpoint-only coverage',
  item: 'items to collect',
  players: 'more than one player',
  teleport: 'teleporters',
  unknown: 'a rule',
};

/** A board in notation becomes playable only when every record it carries is a rule this version plays. */
export function definitionOfNotation(
  notation: NumberlinkNotation
): Validation<NumberlinkDefinition> {
  const unplayable = notation.records.find((record) => record.kind !== 'cover');
  if (unplayable !== undefined)
    return {
      valid: false,
      issues: [
        {
          code: 'unsupported_mechanic',
          message: `This puzzle uses ${MECHANICS[unplayable.kind]}${unplayable.kind === 'unknown' ? ` (${unplayable.tag})` : ''}, which this version of Numberlink cannot play. Update the app or choose another puzzle.`,
        },
      ],
    };
  return {
    valid: true,
    value: {
      format: 1,
      width: notation.width,
      height: notation.height,
      coverage: notation.records.some((record) => record.kind === 'cover')
        ? 'pairs'
        : 'all',
      // Pairs are numbered in letter order and take the palette in turn.
      pairs: notation.pairs.map((pair, index) => ({
        id: pair.letter,
        label: String(index + 1),
        color: PAIR_COLORS[index % PAIR_COLORS.length]!,
        endpoints: [pair.endpoints[0], pair.endpoints[1]],
      })),
    },
  };
}

function readingOrder(a: Cell, b: Cell): number {
  return a.y - b.y || a.x - b.x;
}

/**
 * The notation of a valid JSON definition, for exchanging and comparing
 * boards. Labels, colors and pair ids are not part of a board's notation,
 * so they are renamed in reading order.
 */
export function notationOfDefinition(
  definition: NumberlinkDefinition
): Validation<NumberlinkNotation> {
  if (definition.pairs.length > PAIR_LETTERS.length)
    return {
      valid: false,
      issues: [
        {
          code: 'notation_pairs',
          message: `Notation names at most ${PAIR_LETTERS.length} pairs.`,
        },
      ],
    };
  const pairs: NotationPair[] = definition.pairs
    .map((pair) => [...pair.endpoints].sort(readingOrder))
    .sort((a, b) => readingOrder(a[0]!, b[0]!))
    .map((ends, index) => ({
      letter: PAIR_LETTERS[index]!,
      endpoints: [ends[0]!, ends[1]!],
    }));
  return {
    valid: true,
    value: {
      width: definition.width,
      height: definition.height,
      pairs,
      records:
        definition.coverage === 'pairs'
          ? [{ kind: 'cover', value: 'pairs' }]
          : [],
    },
  };
}
