import { describe, expect, it } from 'bun:test';
import { ValidationError } from '@pkgs/assert-shared/validation-error';
import { asKeyword } from '@pkgs/keyword-shared/keyword';
import type { Message } from '@pkgs/message-shared/message';
import {
  acceptUnknownPayload,
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared/message';
import {
  createComposedMessageRouter,
  createMessageRouter,
} from '@pkgs/message-shared/router';

describe('createMessageRouter', () => {
  it('dispatches to the handler for the registered tag type', () => {
    const ns = createMessageNamespace('app');
    const A = ns('aa', (p): p is number => typeof p === 'number');
    const B = ns('bb', (p): p is string => typeof p === 'string');
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
    const ns = createMessageNamespace('app');
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
    const ns = createMessageNamespace('app');
    const A = ns('aa', acceptUnknownPayload);
    const r = createMessageRouter<
      { id: number },
      { trace: string },
      string
    >().on(A, () => 'hit');
    const msg: Message = { type: asKeyword('app/ghost'), payload: { x: 1 } };
    const out = r.dispatch(
      { id: 7 },
      { trace: 't1' },
      msg,
      (state, ctx, m) => `fb:${state.id}:${ctx.trace}:${m.type}`
    );
    expect(out).toBe('fb:7:t1:app/ghost');
  });

  it('throws ValidationError when type matches but payload fails validation', () => {
    const ns = createMessageNamespace('app');
    const A = ns('aa', (p): p is number => typeof p === 'number');
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
    const ns = createMessageNamespace('app');
    const A = ns('aa', (p): p is number => typeof p === 'number');
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
    const ns = createMessageNamespace('app');
    const A = ns('aa', acceptUnknownPayload);
    const r = createMessageRouter<void, void, void>().on(A, () => {});
    expect(r.has(A({}))).toBe(true);
    expect(r.has({ type: A.type, payload: {} })).toBe(true);
    expect(r.has({ type: asKeyword('app/aaaa'), payload: null })).toBe(false);
    expect(r.has({ type: asKeyword('other/aaa'), payload: {} })).toBe(false);
  });

  it('throws when registering the same tag twice', () => {
    const ns = createMessageNamespace('app');
    const A = ns('aa', acceptUnknownPayload);
    expect(() =>
      createMessageRouter<void, void, void>()
        .on(A, () => {})
        .on(A, () => {})
    ).toThrow(/duplicate message router registration/);
  });

  it('supports several independent routes on one router', () => {
    const ns = createMessageNamespace('game');
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
    const nsA = createMessageNamespace('na');
    const nsB = createMessageNamespace('nb');
    const TagB = nsB('xx', acceptUnknownPayload);
    expect(() =>
      createMessageRouter<void, void, void>(nsA).on(TagB, () => {})
    ).toThrow(/not in router namespace/);
  });

  it('dispatch uses fallback for messages outside namespace without hitting handlers', () => {
    const nsA = createMessageNamespace('na');
    const nsB = createMessageNamespace('nb');
    const TagA = nsA('xx', acceptUnknownPayload);
    const TagB = nsB('xx', acceptUnknownPayload);
    const r = createMessageRouter<void, void, string>(nsA).on(
      TagA,
      () => 'inner'
    );
    expect(r.dispatch(undefined, undefined, TagB({}), () => 'fb')).toBe('fb');
  });

  it('has returns false when message type is outside namespace', () => {
    const ns = createMessageNamespace('zz');
    const Z = ns('one', acceptUnknownPayload);
    const r = createMessageRouter<void, void, void>(ns).on(Z, () => {});
    expect(r.has(Z({}))).toBe(true);
    expect(r.has({ type: asKeyword('other/one'), payload: {} })).toBe(false);
  });
});

describe('createComposedMessageRouter', () => {
  it('routes by wire prefix to the matching namespaced child router', () => {
    const nsA = createMessageNamespace('alpha');
    const nsB = createMessageNamespace('beta');
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
        { type: asKeyword('gamma/xx'), payload: {} },
        () => 'miss'
      )
    ).toBe('miss');
  });

  it('has delegates to the child for that prefix', () => {
    const ns = createMessageNamespace('qq');
    const Q = ns('qq', acceptUnknownPayload);
    const inner = createMessageRouter<void, void, void>(ns).on(Q, () => {});
    const composed = createComposedMessageRouter([
      { namespace: ns, router: inner },
    ]);
    expect(composed.has(Q({}))).toBe(true);
    expect(composed.has({ type: asKeyword('qq/other'), payload: {} })).toBe(
      false
    );
  });

  it('throws when two children share the same namespace prefix', () => {
    const ns = createMessageNamespace('dup');
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
    const nsOuter = createMessageNamespace('outer');
    const nsInner = createMessageNamespace('inner');
    const OuterOnly = nsOuter('oh', acceptUnknownPayload);
    const InnerOnly = nsInner('ih', acceptUnknownPayload);
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
        { type: asKeyword('nope/xx'), payload: {} },
        (s, c, m) => inner.dispatch(s, c, m, () => 'miss')
      )
    ).toBe('miss');
  });
});
