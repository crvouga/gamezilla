import { describe, expect, test } from 'bun:test';
import {
  buildHighlightSegments,
  CODE_EDITOR_LINE_HEIGHT,
  countLines,
  editorFrameHeight,
} from '@pkgs/ui-root-shared/code-editor-highlight';
import type { CodeToken } from '@pkgs/ui-root-shared/code-editor-types';

describe('countLines / editorFrameHeight', () => {
  test('counts newline-separated lines (at least one)', () => {
    expect(countLines('')).toBe(1);
    expect(countLines('a')).toBe(1);
    expect(countLines('a\nb\n')).toBe(3);
  });

  test('frame height honours minLines and padding', () => {
    expect(editorFrameHeight('', 3, 10)).toBe(3 * CODE_EDITOR_LINE_HEIGHT + 20);
    expect(editorFrameHeight('1\n2\n3\n4\n5', 3, 10)).toBe(
      5 * CODE_EDITOR_LINE_HEIGHT + 20
    );
  });
});

describe('buildHighlightSegments', () => {
  const src = 'let x = 42; // hi';
  const tokens: readonly CodeToken[] = [
    { kind: 'keyword', start: 0, end: 3 },
    { kind: 'identifier', start: 4, end: 5 },
    { kind: 'operator', start: 6, end: 7 },
    { kind: 'number', start: 8, end: 10 },
    { kind: 'punctuation', start: 10, end: 11 },
    { kind: 'comment', start: 12, end: 17 },
  ];

  test('fills gaps with plain segments and preserves the full text', () => {
    const segs = buildHighlightSegments(src, tokens);
    expect(segs.map((s) => s.text).join('')).toBe(src);
    expect(segs[0]).toEqual({ kind: 'keyword', text: 'let' });
    expect(segs[1]).toEqual({ kind: 'plain', text: ' ' });
    expect(segs.at(-1)).toEqual({ kind: 'comment', text: '// hi' });
  });

  test('clips overlapping and out-of-range tokens', () => {
    const segs = buildHighlightSegments('abcdef', [
      { kind: 'keyword', start: 0, end: 4 },
      { kind: 'string', start: 2, end: 5 },
      { kind: 'number', start: 5, end: 99 },
    ]);
    expect(segs).toEqual([
      { kind: 'keyword', text: 'abcd' },
      { kind: 'string', text: 'e' },
      { kind: 'number', text: 'f' },
    ]);
  });

  test('empty value yields no segments', () => {
    expect(buildHighlightSegments('', [])).toEqual([]);
  });
});
