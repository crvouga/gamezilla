import { describe, expect, it } from 'bun:test'
import { ValidationError } from '@gamezilla/lib/assert'
import {
  acceptUnknownPayload,
  createNamespace,
  isPlainRecord,
  type Message,
} from './message'
import { createMessageRouter } from './router'

describe('createMessageRouter', () => {
  it('dispatches to the handler for the registered tag type', () => {
    const ns = createNamespace('app')
    const A = ns('a', (p): p is number => typeof p === 'number')
    const B = ns('b', (p): p is string => typeof p === 'string')
    const r = createMessageRouter<void, void, string>()
      .on(A, (_, __, msg) => `num:${msg.payload}`)
      .on(B, (_, __, msg) => `str:${msg.payload}`)

    expect(r.dispatch(undefined, undefined, A(42), () => 'miss')).toBe('num:42')
    expect(r.dispatch(undefined, undefined, B('x'), () => 'miss')).toBe('str:x')
  })

  it('forwards state and ctx to the matched handler', () => {
    const ns = createNamespace('app')
    const Ping = ns('ping', (p): p is { n: number } =>
      isPlainRecord(p) && typeof p['n'] === 'number',
    )
    type S = { sum: number }
    type C = { label: string }
    const r = createMessageRouter<S, C, string>()
      .on(Ping, (state, ctx, msg) => `${ctx.label}:${state.sum + msg.payload.n}`)

    const out = r.dispatch(
      { sum: 10 },
      { label: 'ok' },
      Ping({ n: 3 }),
      () => 'miss',
    )
    expect(out).toBe('ok:13')
  })

  it('calls fallback with state, ctx, and message when no handler exists', () => {
    const ns = createNamespace('app')
    const A = ns('a', acceptUnknownPayload)
    const r = createMessageRouter<{ id: number }, { trace: string }, string>().on(
      A,
      () => 'hit',
    )
    const msg: Message = { type: 'app/ghost', payload: { x: 1 } }
    const out = r.dispatch(
      { id: 7 },
      { trace: 't1' },
      msg,
      (state, ctx, m) => `fb:${state.id}:${ctx.trace}:${m.type}`,
    )
    expect(out).toBe('fb:7:t1:app/ghost')
  })

  it('throws ValidationError when type matches but payload fails validation', () => {
    const ns = createNamespace('app')
    const A = ns('a', (p): p is number => typeof p === 'number')
    const r = createMessageRouter<void, void, string>().on(A, () => 'hit')
    expect(() =>
      r.dispatch(
        undefined,
        undefined,
        { type: A.type, payload: 'not-a-number' },
        () => 'fb',
      ),
    ).toThrow(ValidationError)
  })

  it('includes message type in ValidationError context', () => {
    const ns = createNamespace('app')
    const A = ns('a', (p): p is number => typeof p === 'number')
    const r = createMessageRouter<void, void, string>().on(A, () => 'hit')
    try {
      r.dispatch(
        undefined,
        undefined,
        { type: A.type, payload: false },
        () => 'fb',
      )
      expect.unreachable()
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError)
      const ve = e as ValidationError
      expect(ve.context['type']).toBe(A.type)
      expect(ve.context['payload']).toBe(false)
    }
  })

  it('has returns true only for a registered full type', () => {
    const ns = createNamespace('app')
    const A = ns('a', acceptUnknownPayload)
    const r = createMessageRouter<void, void, void>().on(A, () => {})
    expect(r.has(A({}))).toBe(true)
    expect(r.has({ type: A.type, payload: {} })).toBe(true)
    expect(r.has({ type: 'app/b', payload: null })).toBe(false)
    expect(r.has({ type: 'other/a', payload: {} })).toBe(false)
  })

  it('throws when registering the same tag twice', () => {
    const ns = createNamespace('app')
    const A = ns('a', acceptUnknownPayload)
    expect(() =>
      createMessageRouter<void, void, void>()
        .on(A, () => {})
        .on(A, () => {}),
    ).toThrow(/duplicate message router registration/)
  })

  it('supports several independent routes on one router', () => {
    const ns = createNamespace('game')
    const Move = ns('move', (p): p is { to: number } =>
      isPlainRecord(p) &&
      typeof p['to'] === 'number' &&
      Number.isInteger(p['to']),
    )
    const Chat = ns('chat', (p): p is { text: string } =>
      isPlainRecord(p) && typeof p['text'] === 'string',
    )
    const r = createMessageRouter<null, null, string>()
      .on(Move, () => 'moved')
      .on(Chat, (_, __, msg) => msg.payload.text.toUpperCase())

    expect(r.dispatch(null, null, Move({ to: 0 }), () => 'x')).toBe('moved')
    expect(r.dispatch(null, null, Chat({ text: 'hi' }), () => 'x')).toBe('HI')
  })
})
