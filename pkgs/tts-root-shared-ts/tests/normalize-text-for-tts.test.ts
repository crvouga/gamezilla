import { describe, expect, test } from 'bun:test';

import { normalizeTextForTts } from '@pkgs/tts-root-shared-ts/normalize-text-for-tts';

describe('normalizeTextForTts', () => {
  test('replaces em dash with comma', () => {
    expect(
      normalizeTextForTts('Checkmate is in the air — can you find it?')
    ).toBe('Checkmate is in the air, can you find it?');
  });

  test('replaces en dash with comma', () => {
    expect(normalizeTextForTts('Back rank – worth a look')).toBe(
      'Back rank, worth a look'
    );
  });

  test('leaves chess square hyphens alone', () => {
    expect(normalizeTextForTts('e2-e4 misses. You are close.')).toBe(
      'e2-e4 misses. You are close.'
    );
  });

  test('replaces curly quotes and ellipsis', () => {
    expect(normalizeTextForTts('“Nice”… done')).toBe('"Nice"... done');
  });

  test('passes through plain ASCII unchanged', () => {
    expect(normalizeTextForTts('You got it. Well played.')).toBe(
      'You got it. Well played.'
    );
  });
});
