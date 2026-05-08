import { describe, expect, it } from 'bun:test';
import { createAttrNamespace } from './attribute';

describe('createAttrNamespace', () => {
  it('rejects empty prefix', () => {
    expect(() => createAttrNamespace('')).toThrow();
  });

  it('rejects slash in prefix', () => {
    expect(() => createAttrNamespace('a/b')).toThrow();
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

  it('callable parses raw value', () => {
    const ns = createAttrNamespace('games');
    const Selected = ns('selected', (v): 'chess' | null =>
      v === 'chess' ? 'chess' : null
    );
    expect(Selected('chess')).toBe('chess');
    expect(Selected('nope')).toBe(null);
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
});
