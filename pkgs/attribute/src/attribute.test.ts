import { Assert } from '@gamezilla/assert';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import { createAttrNamespace, type AttributeState } from './attribute';

let disposeTestCrashHandler: () => void;
beforeAll(() => {
  disposeTestCrashHandler = Assert.registerCrashHandler({
    priority: 0,
    match: () => true,
    crash(message, context) {
      throw new Error(
        context === undefined
          ? message
          : `${message} ${JSON.stringify(context)}`
      );
    },
  });
});
afterAll(() => {
  disposeTestCrashHandler();
});

describe('createAttrNamespace', () => {
  it('rejects zero segments', () => {
    expect(() => createAttrNamespace()).toThrow();
  });

  it('rejects invalid segment (slash)', () => {
    expect(() => createAttrNamespace('a/b')).toThrow();
  });

  it('rejects invalid segment (consecutive hyphens)', () => {
    expect(() => createAttrNamespace('a--b')).toThrow();
  });

  it('rejects digit-first segment', () => {
    expect(() => createAttrNamespace('0bad')).toThrow();
  });

  it('rejects single-character namespace segment', () => {
    expect(() => createAttrNamespace('x')).toThrow();
  });

  it('rejects camelCase segment', () => {
    expect(() => createAttrNamespace('helloWorld')).toThrow();
  });

  it('joins multiple segments with dots', () => {
    const ns = createAttrNamespace('chess', 'main-menu');
    expect(ns.prefix).toBe('chess.main-menu');
  });

  it('rejects empty name', () => {
    const ns = createAttrNamespace('games');
    expect(() => ns('', (v) => v)).toThrow();
  });

  it('rejects slash in name', () => {
    const ns = createAttrNamespace('games');
    expect(() => ns('foo/bar', (v) => v)).toThrow();
  });

  it('rejects camelCase local name', () => {
    const ns = createAttrNamespace('games');
    expect(() => ns('displayName', (v) => v)).toThrow();
  });

  it('rejects single-character local name', () => {
    const ns = createAttrNamespace('games');
    expect(() => ns('x', (v) => v)).toThrow();
  });

  it('builds full key as prefix/name', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (v): string | null =>
      typeof v === 'string' ? v : null
    );
    expect(String(Selected.key)).toBe('games/selected');
  });

  it('callable builds single-key patch', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (v): 'chess' | null =>
      v === 'chess' ? 'chess' : null
    );
    expect(Selected('chess')).toEqual({ 'games/selected': 'chess' });
    expect(Selected('nope')).toEqual({ 'games/selected': null });
  });

  it('.parse validates raw value without wrapping', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (v): 'chess' | null =>
      v === 'chess' ? 'chess' : null
    );
    expect(Selected.parse('chess')).toBe('chess');
    expect(Selected.parse('nope')).toBe(null);
  });

  it('.from reads flat key and parses', () => {
    const ns = createAttrNamespace('profile');
    const DisplayName = ns('display-name', (v): string =>
      typeof v === 'string' ? v : ''
    );
    const state: AttributeState = DisplayName('Ada');
    expect(DisplayName.from(state)).toBe('Ada');
    expect(DisplayName.from({} as AttributeState)).toBe('');
  });

  it('parser throw propagates from callable', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (_v): never => {
      throw new Error('bad');
    });
    expect(() => Selected('x')).toThrow('bad');
  });

  it('parser throw propagates from .from', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (_v): never => {
      throw new Error('bad');
    });
    const state = { [Selected.key]: 1 } as AttributeState;
    expect(() => Selected.from(state)).toThrow('bad');
  });

  it('parser throw propagates from .parse', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (_v): never => {
      throw new Error('bad');
    });
    expect(() => Selected.parse(1)).toThrow('bad');
  });
});
