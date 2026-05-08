import { Assert } from '@gamezilla/lib/assert';
import { afterAll, beforeAll, describe, expect, it } from 'bun:test';
import {
  acceptUnknownPayload,
  createMessageNamespace,
  isPlainRecord,
  type Message,
} from './message';

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

describe('createMessageNamespace', () => {
  it('rejects zero segments', () => {
    expect(() => createMessageNamespace()).toThrow();
  });

  it('rejects empty segment', () => {
    expect(() => createMessageNamespace('')).toThrow();
  });

  it('rejects slash in segment', () => {
    expect(() => createMessageNamespace('a/b')).toThrow();
  });

  it('rejects camelCase segment', () => {
    expect(() => createMessageNamespace('ticTacToe')).toThrow();
  });

  it('rejects empty name', () => {
    const ns = createMessageNamespace('tic-tac-toe');
    expect(() => ns('', acceptUnknownPayload)).toThrow();
  });

  it('rejects slash in name', () => {
    const ns = createMessageNamespace('tic-tac-toe');
    expect(() => ns('foo/bar', acceptUnknownPayload)).toThrow();
  });

  it('joins variadic segments with dots', () => {
    const ns = createMessageNamespace('tic', 'tac', 'toe');
    expect(ns.prefix).toBe('tic.tac.toe');
    const Foo = ns(
      'foo',
      (p): p is { x: number } => isPlainRecord(p) && typeof p['x'] === 'number'
    );
    expect(Foo.type).toBe('tic.tac.toe/foo');
  });

  it('builds full type as prefix/name', () => {
    const ns = createMessageNamespace('tic-tac-toe');
    const Foo = ns(
      'foo',
      (p): p is { x: number } => isPlainRecord(p) && typeof p['x'] === 'number'
    );
    expect(Foo.type).toBe('tic-tac-toe/foo');
    const m = Foo({ x: 1 });
    expect(m).toEqual({ type: 'tic-tac-toe/foo', payload: { x: 1 } });
  });

  it('constructor throws when validator rejects', () => {
    const ns = createMessageNamespace('tic-tac-toe');
    const Foo = ns(
      'foo',
      (p): p is { x: number } => isPlainRecord(p) && typeof p['x'] === 'number'
    );
    expect(() => Foo({ x: 'bad' })).toThrow();
  });

  it('Foo.is narrows and rejects other tags', () => {
    const ns = createMessageNamespace('tic-tac-toe');
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
    const ns = createMessageNamespace('tic-tac-toe');
    const Foo = ns(
      'foo',
      (p): p is { x: number } => isPlainRecord(p) && typeof p['x'] === 'number'
    );
    const msg: Message = { type: Foo.type, payload: { x: 'nope' } };
    expect(Foo.is(msg)).toBe(false);
  });

  it('owns returns true only for messages in that namespace', () => {
    const ns = createMessageNamespace('tic-tac-toe');
    const Foo = ns('foo', acceptUnknownPayload);
    expect(ns.owns(Foo({}))).toBe(true);
    expect(ns.owns({ type: 'other/foo', payload: null })).toBe(false);
  });
});
