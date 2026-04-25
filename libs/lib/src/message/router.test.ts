import { ValidationError } from '@gamezilla/lib/assert';
import { describe, expect, it } from 'bun:test';
import {
  acceptUnknownPayload,
  createNamespace,
  isPlainRecord,
  type Message,
} from './message';
import { createComposedMessageRouter, createMessageRouter } from './router';

describe('createMessageRouter', () => {
  it('dispatches to the handler for the registered tag type', () => {
    const ns = createNamespace('app');
    const A = ns('a', (p): p is number => typeof p === 'number');
    const B = ns('b', (p): p is string => typeof p === 'string');
    const r = createMessageRouter<void, void, string>()
      .on(A, (_, __, msg) => `num:${msg.payload}`)
      .on(B, (_, __, msg) => `str:${msg.payload}`);

    expect(r.dispatch(undefined, undefined, A(42), () => 'miss')).toBe(
      'num:42'
    );
    expect(r.dispatch(undefined, undefined, B('x'), () => 'miss')).toBe(
      'str:x'
    );
  });

  it('forwards state and ctx to the matched handler', () => {
    const ns = createNamespace('app');
    const Ping = ns(
      'ping',
      (p): p is { n: number } => isPlainRecord(p) && typeof p['n'] === 'number'
    );
    type S = { sum: number };
    type C = { label: string };
    const r = createMessageRouter<S, C, string>().on(
      Ping,
      (state, ctx, msg) => `${ctx.label}:${state.sum + msg.payload.n}`
    );

    const out = r.dispatch(
      { sum: 10 },
      { label: 'ok' },
      Ping({ n: 3 }),
      () => 'miss'
    );
    expect(out).toBe('ok:13');
  });

  it('calls fallback with state, ctx, and message when no handler exists', () => {
    const ns = createNamespace('app');
    const A = ns('a', acceptUnknownPayload);
    const r = createMessageRouter<
      { id: number },
      { trace: string },
      string
    >().on(A, () => 'hit');
    const msg: Message = { type: 'app/ghost', payload: { x: 1 } };
    const out = r.dispatch(
      { id: 7 },
      { trace: 't1' },
      msg,
      (state, ctx, m) => `fb:${state.id}:${ctx.trace}:${m.type}`
    );
    expect(out).toBe('fb:7:t1:app/ghost');
  });

  it('throws ValidationError when type matches but payload fails validation', () => {
    const ns = createNamespace('app');
    const A = ns('a', (p): p is number => typeof p === 'number');
    const r = createMessageRouter<void, void, string>().on(A, () => 'hit');
    expect(() =>
      r.dispatch(
        undefined,
        undefined,
        { type: A.type, payload: 'not-a-number' },
        () => 'fb'
      )
    ).toThrow(ValidationError);
  });

  it('includes message type in ValidationError context', () => {
    const ns = createNamespace('app');
    const A = ns('a', (p): p is number => typeof p === 'number');
    const r = createMessageRouter<void, void, string>().on(A, () => 'hit');
    try {
      r.dispatch(
        undefined,
        undefined,
        { type: A.type, payload: false },
        () => 'fb'
      );
      expect.unreachable();
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      const ve = e as ValidationError;
      expect(ve.context['type']).toBe(A.type);
      expect(ve.context['payload']).toBe(false);
    }
  });

  it('has returns true only for a registered full type', () => {
    const ns = createNamespace('app');
    const A = ns('a', acceptUnknownPayload);
    const r = createMessageRouter<void, void, void>().on(A, () => {});
    expect(r.has(A({}))).toBe(true);
    expect(r.has({ type: A.type, payload: {} })).toBe(true);
    expect(r.has({ type: 'app/b', payload: null })).toBe(false);
    expect(r.has({ type: 'other/a', payload: {} })).toBe(false);
  });

  it('throws when registering the same tag twice', () => {
    const ns = createNamespace('app');
    const A = ns('a', acceptUnknownPayload);
    expect(() =>
      createMessageRouter<void, void, void>()
        .on(A, () => {})
        .on(A, () => {})
    ).toThrow(/duplicate message router registration/);
  });

  it('supports several independent routes on one router', () => {
    const ns = createNamespace('game');
    const Move = ns(
      'move',
      (p): p is { to: number } =>
        isPlainRecord(p) &&
        typeof p['to'] === 'number' &&
        Number.isInteger(p['to'])
    );
    const Chat = ns(
      'chat',
      (p): p is { text: string } =>
        isPlainRecord(p) && typeof p['text'] === 'string'
    );
    const r = createMessageRouter<null, null, string>()
      .on(Move, () => 'moved')
      .on(Chat, (_, __, msg) => msg.payload.text.toUpperCase());

    expect(r.dispatch(null, null, Move({ to: 0 }), () => 'x')).toBe('moved');
    expect(r.dispatch(null, null, Chat({ text: 'hi' }), () => 'x')).toBe('HI');
  });
});

describe('createMessageRouter with namespace', () => {
  it('rejects .on() when tag is not in the router namespace', () => {
    const nsA = createNamespace('a');
    const nsB = createNamespace('b');
    const TagB = nsB('x', acceptUnknownPayload);
    expect(() =>
      createMessageRouter<void, void, void>(nsA).on(TagB, () => {})
    ).toThrow(/not in router namespace/);
  });

  it('dispatch uses fallback for messages outside namespace without hitting handlers', () => {
    const nsA = createNamespace('a');
    const nsB = createNamespace('b');
    const TagA = nsA('x', acceptUnknownPayload);
    const TagB = nsB('x', acceptUnknownPayload);
    const r = createMessageRouter<void, void, string>(nsA).on(
      TagA,
      () => 'inner'
    );
    expect(r.dispatch(undefined, undefined, TagB({}), () => 'fb')).toBe('fb');
  });

  it('has returns false when message type is outside namespace', () => {
    const ns = createNamespace('z');
    const Z = ns('one', acceptUnknownPayload);
    const r = createMessageRouter<void, void, void>(ns).on(Z, () => {});
    expect(r.has(Z({}))).toBe(true);
    expect(r.has({ type: 'other/one', payload: {} })).toBe(false);
  });
});

describe('createComposedMessageRouter', () => {
  it('routes by wire prefix to the matching namespaced child router', () => {
    const nsA = createNamespace('alpha');
    const nsB = createNamespace('beta');
    const Afoo = nsA('foo', acceptUnknownPayload);
    const Bbar = nsB('bar', acceptUnknownPayload);
    const routerA = createMessageRouter<void, void, string>(nsA).on(
      Afoo,
      () => 'a'
    );
    const routerB = createMessageRouter<void, void, string>(nsB).on(
      Bbar,
      () => 'b'
    );
    const composed = createComposedMessageRouter([
      { namespace: nsA, router: routerA },
      { namespace: nsB, router: routerB },
    ]);
    expect(
      composed.dispatch(undefined, undefined, Afoo({}), () => 'miss')
    ).toBe('a');
    expect(
      composed.dispatch(undefined, undefined, Bbar({}), () => 'miss')
    ).toBe('b');
    expect(
      composed.dispatch(
        undefined,
        undefined,
        { type: 'gamma/x', payload: {} },
        () => 'miss'
      )
    ).toBe('miss');
  });

  it('has delegates to the child for that prefix', () => {
    const ns = createNamespace('q');
    const Q = ns('q', acceptUnknownPayload);
    const inner = createMessageRouter<void, void, void>(ns).on(Q, () => {});
    const composed = createComposedMessageRouter([
      { namespace: ns, router: inner },
    ]);
    expect(composed.has(Q({}))).toBe(true);
    expect(composed.has({ type: 'q/other', payload: {} })).toBe(false);
  });

  it('throws when two children share the same namespace prefix', () => {
    const ns = createNamespace('dup');
    const r = createMessageRouter<void, void, void>(ns);
    expect(() =>
      createComposedMessageRouter([
        { namespace: ns, router: r },
        { namespace: ns, router: r },
      ])
    ).toThrow(/duplicate composed router namespace prefix/);
  });
});

describe('composing message routers (fallback delegation)', () => {
  it('outer fallback delegates to an inner router', () => {
    const nsOuter = createNamespace('outer');
    const nsInner = createNamespace('inner');
    const OuterOnly = nsOuter('o', acceptUnknownPayload);
    const InnerOnly = nsInner('i', acceptUnknownPayload);
    const inner = createMessageRouter<void, void, string>(nsInner).on(
      InnerOnly,
      () => 'inner-hit'
    );
    const outer = createMessageRouter<void, void, string>(nsOuter).on(
      OuterOnly,
      () => 'outer-hit'
    );
    expect(
      outer.dispatch(undefined, undefined, OuterOnly({}), () => 'miss')
    ).toBe('outer-hit');
    expect(
      outer.dispatch(undefined, undefined, InnerOnly({}), (s, c, m) =>
        inner.dispatch(s, c, m, () => 'miss')
      )
    ).toBe('inner-hit');
    expect(
      outer.dispatch(
        undefined,
        undefined,
        { type: 'nope/x', payload: {} },
        (s, c, m) => inner.dispatch(s, c, m, () => 'miss')
      )
    ).toBe('miss');
  });
});
