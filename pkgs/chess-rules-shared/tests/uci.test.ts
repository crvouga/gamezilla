import { describe, expect, test } from 'bun:test';
import {
  formatUci,
  parseUci,
  tokenizeUciLine,
} from '@pkgs/chess-rules-shared/uci';

describe('uci', () => {
  test('parses and formats plain and promotion moves', () => {
    expect(parseUci('e2e4')).toEqual({ from: 'e2', to: 'e4' });
    expect(parseUci(' E7E8Q ')).toEqual({
      from: 'e7',
      to: 'e8',
      promotion: 'q',
    });
    expect(formatUci({ from: 'a7', to: 'b8', promotion: 'n' })).toBe('a7b8n');
  });

  test('rejects malformed input', () => {
    for (const bad of ['', 'e2', 'e2e9', 'i2e4', 'e7e8k', 'e2e4qq', 'e2e2']) {
      expect(parseUci(bad)).toBeNull();
    }
  });

  test('tokenizes a move line', () => {
    expect(tokenizeUciLine('  E2E4   e7e5 ')).toEqual(['e2e4', 'e7e5']);
    expect(tokenizeUciLine('')).toEqual([]);
  });
});
