import { describe, expect, it } from 'bun:test'
import { createMessageRouter } from './router'
import {
  acceptUnknownPayload,
  createNamespace,
  isPlainRecord,
  type Message,
} from './message'

describe('createNamespace', () => {
  it('rejects empty prefix', () => {
    expect(() => createNamespace('')).toThrow()
  })

  it('rejects slash in prefix', () => {
    expect(() => createNamespace('a/b')).toThrow()
  })

  it('rejects empty name', () => {
    const ns = createNamespace('ticTacToe')
    expect(() => ns('', acceptUnknownPayload)).toThrow()
  })

  it('rejects slash in name', () => {
    const ns = createNamespace('ticTacToe')
    expect(() => ns('foo/bar', acceptUnknownPayload)).toThrow()
  })

  it('builds full type as prefix/name', () => {
    const ns = createNamespace('ticTacToe')
    const Foo = ns('foo', (p): p is { x: number } =>
      isPlainRecord(p) && typeof p['x'] === 'number',
    )
    expect(Foo.type).toBe('ticTacToe/foo')
    const m = Foo({ x: 1 })
    expect(m).toEqual({ type: 'ticTacToe/foo', payload: { x: 1 } })
  })

  it('constructor throws when validator rejects', () => {
    const ns = createNamespace('ticTacToe')
    const Foo = ns('foo', (p): p is { x: number } =>
      isPlainRecord(p) && typeof p['x'] === 'number',
    )
    expect(() => Foo({ x: 'bad' })).toThrow()
  })

  it('Foo.is narrows and rejects other tags', () => {
    const ns = createNamespace('ticTacToe')
    const Foo = ns('foo', acceptUnknownPayload)
    const Bar = ns('bar', acceptUnknownPayload)
    const a: Message = Foo({})
    expect(Foo.is(a)).toBe(true)
    expect(Bar.is(a)).toBe(false)
    const b = Bar({})
    expect(Foo.is(b)).toBe(false)
    expect(b.type).toBe(Bar.type)
  })

  it('Foo.is rejects payload when validator fails', () => {
    const ns = createNamespace('ticTacToe')
    const Foo = ns('foo', (p): p is { x: number } =>
      isPlainRecord(p) && typeof p['x'] === 'number',
    )
    const msg: Message = { type: Foo.type, payload: { x: 'nope' } }
    expect(Foo.is(msg)).toBe(false)
  })

  it('owns returns true only for messages in that namespace', () => {
    const ns = createNamespace('ticTacToe')
    const Foo = ns('foo', acceptUnknownPayload)
    expect(ns.owns(Foo({}))).toBe(true)
    expect(ns.owns({ type: 'other/foo', payload: null })).toBe(false)
  })
})

describe('createMessageRouter', () => {
  it('dispatches to the handler for the tag type', () => {
    const ns = createNamespace('app')
    const A = ns('a', (p): p is number => typeof p === 'number')
    const B = ns('b', (p): p is string => typeof p === 'string')
    const r = createMessageRouter<void, void, string>()
      .on(A, (_, __, msg) => `num:${msg.payload}`)
      .on(B, (_, __, msg) => `str:${msg.payload}`)

    expect(r.dispatch(undefined, undefined, A(42), () => 'miss')).toBe('num:42')
    expect(r.dispatch(undefined, undefined, B('x'), () => 'miss')).toBe('str:x')
  })

  it('calls fallback when no handler', () => {
    const ns = createNamespace('app')
    const A = ns('a', acceptUnknownPayload)
    const r = createMessageRouter<void, void, string>().on(A, () => 'hit')
    expect(
      r.dispatch(undefined, undefined, { type: 'app/unknown', payload: {} }, () => 'fb'),
    ).toBe('fb')
  })

  it('throws when type matches but payload fails validation', () => {
    const ns = createNamespace('app')
    const A = ns('a', (p): p is number => typeof p === 'number')
    const r = createMessageRouter<void, void, string>().on(A, () => 'hit')
    expect(() =>
      r.dispatch(undefined, undefined, { type: A.type, payload: 'not-a-number' }, () => 'fb'),
    ).toThrow()
  })

  it('has reflects registration', () => {
    const ns = createNamespace('app')
    const A = ns('a', acceptUnknownPayload)
    const r = createMessageRouter<void, void, void>().on(A, () => {})
    expect(r.has(A({}))).toBe(true)
    expect(r.has({ type: 'app/b', payload: null })).toBe(false)
  })

  it('throws on duplicate on()', () => {
    const ns = createNamespace('app')
    const A = ns('a', acceptUnknownPayload)
    expect(() =>
      createMessageRouter<void, void, void>()
        .on(A, () => {})
        .on(A, () => {}),
    ).toThrow()
  })
})
