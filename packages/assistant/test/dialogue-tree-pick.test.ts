import { describe, expect, test } from 'bun:test';

import {
  pickDialogueVariant,
  pickDialogueVariantIndex,
  substituteDialogueText,
} from '../src/shared/dialogue-tree';

function seqRng(values: readonly number[]): { nextU01(): number } {
  let i = 0;
  return {
    nextU01() {
      const v = values[i % values.length] ?? 0;
      i += 1;
      return v;
    },
  };
}

describe('pickDialogueVariant', () => {
  test('rotates variants without repeating the previous pick for the same key', () => {
    const lastIndexByKey = new Map<string, number>();
    const lookupKey = { bucket: 'start', theme: 'fork' };
    const rng = seqRng([0, 0, 0.5, 0.5]);
    const first = pickDialogueVariantIndex({
      variantCount: 3,
      lookupKey,
      rng,
      lastIndexByKey,
    });
    const second = pickDialogueVariantIndex({
      variantCount: 3,
      lookupKey,
      rng,
      lastIndexByKey,
    });
    expect(first).toBe(0);
    expect(second).not.toBe(first);
  });

  test('dedupes independently per lookup key', () => {
    const lastIndexByKey = new Map<string, number>();
    const rng = seqRng([0, 0]);
    const a = pickDialogueVariantIndex({
      variantCount: 2,
      lookupKey: { bucket: 'wrong', theme: 'pin' },
      rng,
      lastIndexByKey,
    });
    const b = pickDialogueVariantIndex({
      variantCount: 2,
      lookupKey: { bucket: 'progress', theme: 'pin' },
      rng,
      lastIndexByKey,
    });
    expect(a).toBe(0);
    expect(b).toBe(0);
  });

  test('substitutes placeholders from context', () => {
    const text = pickDialogueVariant({
      variants: ['You play {playerColour}, move {movesPlayed}/{movesTotal}.'],
      lookupKey: { bucket: 'start' },
      ctx: { playerColour: 'white', movesPlayed: 1, movesTotal: 3 },
      rng: seqRng([0]),
      lastIndexByKey: new Map(),
    });
    expect(text).toBe('You play white, move 1/3.');
  });
});

describe('substituteDialogueText', () => {
  test('replaces missing placeholders with empty string', () => {
    expect(substituteDialogueText('Hi {name}!', {})).toBe('Hi !');
  });
});
