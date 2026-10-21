import { describe, expect, test } from 'bun:test';
import { bannedWordViolations } from './banned-words';

function hits(text: string): number {
  return bannedWordViolations({ paths: [], files: [{ path: 'f.ts', text }] })
    .length;
}

describe('bannedWordViolations', () => {
  test('e2e is banned as a word, segment, constant or identifier part', () => {
    expect(hits('run the e2e suite')).toBe(1);
    expect(hits('"test:e2e": "bun run x"')).toBe(1);
    expect(hits('VITE_E2E=1')).toBe(1);
    expect(hits('const e2eHooks = true;')).toBe(1);
    expect(hits('function ChessPuzzleE2eHints() {}')).toBe(1);
    expect(hits('type ReviewE2E = {}')).toBe(1);
    expect(hits('End to end, E2E.')).toBe(1);
  });

  test('chess moves and hex digests are not the word', () => {
    expect(hits("play(FEN.start, 'e2e4', 'e7e5')")).toBe(0);
    expect(hits("parseUci('E2E4')")).toBe(0);
    expect(hits('"zh:9fbb857fe2edbfaf0f4d6bf4"')).toBe(0);
    expect(hits('"82ef2fe2e"')).toBe(0);
  });

  test('a path segment is reported with the replacement', () => {
    const out = bannedWordViolations({
      paths: ['tests/e2e/support/open.ts', 'tests/harness/open.ts'],
      files: [],
    });
    expect(out).toHaveLength(1);
    expect(out[0]).toContain('tests/e2e/support/open.ts');
    expect(out[0]).toContain('test:spec');
  });

  test('each offending line is reported with its number', () => {
    const out = bannedWordViolations({
      paths: [],
      files: [{ path: 'a.md', text: 'fine\nan e2e test\nfine' }],
    });
    expect(out).toEqual([
      expect.stringContaining('a.md:2:'),
    ] as unknown as string[]);
  });
});
