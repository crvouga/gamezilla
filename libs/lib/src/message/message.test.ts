import { describe, expect, it } from 'bun:test';
import {
  acceptUnknownPayload,
  createNamespace,
  isPlainRecord,
  type Message,
} from './message';

describe('createNamespace', () => {
  it('rejects empty prefix', () => {
    expect(() => createNamespace('')).toThrow();
  });

  it('rejects slash in prefix', () => {
    expect(() => createNamespace('a/b')).toThrow();
  });

  it('rejects empty name', () => {
    const ns = createNamespace('ticTacToe');
    expect(() => ns('', acceptUnknownPayload)).toThrow();
  });

  it('rejects slash in name', () => {
    const ns = createNamespace('ticTacToe');
    expect(() => ns('foo/bar', acceptUnknownPayload)).toThrow();
  });

  it('builds full type as prefix/name', () => {
    const ns = createNamespace('ticTacToe');
    const Foo = ns(
      'foo',
      (p): p is { x: number } => isPlainRecord(p) && typeof p['x'] === 'number'
    );
    expect(Foo.type).toBe('ticTacToe/foo');
    const m = Foo({ x: 1 });
    expect(m).toEqual({ type: 'ticTacToe/foo', payload: { x: 1 } });
  });

  it('constructor throws when validator rejects', () => {
    const ns = createNamespace('ticTacToe');
    const Foo = ns(
      'foo',
      (p): p is { x: number } => isPlainRecord(p) && typeof p['x'] === 'number'
    );
    expect(() => Foo({ x: 'bad' })).toThrow();
  });

  it('Foo.is narrows and rejects other tags', () => {
    const ns = createNamespace('ticTacToe');
    const Foo = ns('foo', acceptUnknownPayload);
    const Bar = ns('bar', acceptUnknownPayload);
    const a: Message = Foo({});
    expect(Foo.is(a)).toBe(true);
    expect(Bar.is(a)).toBe(false);
    const b = Bar({});
    expect(Foo.is(b)).toBe(false);
    expect(b.type).toBe(Bar.type);
  });

  it('Foo.is rejects payload when validator fails', () => {
    const ns = createNamespace('ticTacToe');
    const Foo = ns(
      'foo',
      (p): p is { x: number } => isPlainRecord(p) && typeof p['x'] === 'number'
    );
    const msg: Message = { type: Foo.type, payload: { x: 'nope' } };
    expect(Foo.is(msg)).toBe(false);
  });

  it('owns returns true only for messages in that namespace', () => {
    const ns = createNamespace('ticTacToe');
    const Foo = ns('foo', acceptUnknownPayload);
    expect(ns.owns(Foo({}))).toBe(true);
    expect(ns.owns({ type: 'other/foo', payload: null })).toBe(false);
  });
});
