import { describe, expect, it } from 'bun:test';
import { createAttrNamespace, isValidPatchDbAttributeKey } from './attribute';

describe('isValidPatchDbAttributeKey', () => {
  it('accepts PatchDB-style keys', () => {
    expect(isValidPatchDbAttributeKey('todo/title')).toBe(true);
    expect(isValidPatchDbAttributeKey('my.namespace/attr')).toBe(true);
    expect(isValidPatchDbAttributeKey('patch/syncRejectedAt')).toBe(true);
  });

  it('rejects whitespace and bad segments', () => {
    expect(isValidPatchDbAttributeKey('bad key/x')).toBe(false);
    expect(isValidPatchDbAttributeKey('0prefix/name')).toBe(false);
    expect(isValidPatchDbAttributeKey('prefix/9nope')).toBe(false);
    expect(isValidPatchDbAttributeKey('onlyOne')).toBe(false);
    expect(isValidPatchDbAttributeKey('a/b/c')).toBe(false);
  });
});

describe('createAttrNamespace', () => {
  it('rejects empty prefix', () => {
    expect(() => createAttrNamespace('')).toThrow();
  });

  it('rejects slash in prefix', () => {
    expect(() => createAttrNamespace('a/b')).toThrow();
  });

  it('rejects invalid PatchDB segment in prefix', () => {
    expect(() => createAttrNamespace('0bad')).toThrow();
  });

  it('rejects empty name', () => {
    const ns = createAttrNamespace('games');
    expect(() => ns('', (v) => v)).toThrow();
  });

  it('rejects slash in name', () => {
    const ns = createAttrNamespace('games');
    expect(() => ns('foo/bar', (v) => v)).toThrow();
  });

  it('builds full key as prefix/name', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (v): string | null =>
      typeof v === 'string' ? v : null
    );
    expect(Selected.key).toBe('games/selected');
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
    const DisplayName = ns('displayName', (v): string =>
      typeof v === 'string' ? v : ''
    );
    expect(DisplayName.from({ 'profile/displayName': 'Ada' })).toBe('Ada');
    expect(DisplayName.from({})).toBe('');
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
    expect(() => Selected.from({ 'games/selected': 1 })).toThrow('bad');
  });

  it('parser throw propagates from .parse', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (_v): never => {
      throw new Error('bad');
    });
    expect(() => Selected.parse(1)).toThrow('bad');
  });
});
