/**
 * Microbenchmark for {@link createMessageRouter} and {@link createComposedMessageRouter}
 * dispatch hot paths.
 *
 * Run:
 *   bun src/message/router.bench.ts
 *
 * The current router is imported normally; the previous implementation is inlined
 * below as `legacyCreateMessageRouter` / `legacyCreateComposedMessageRouter` so we
 * can compare both in the same process under the same JIT.
 *
 * Each scenario runs warmup iterations to stabilize the JIT, then a measured batch.
 * We report ns/op, ops/sec, and (current vs legacy) speedup.
 */
import { Assert } from '@gamezilla/lib/assert';
import {
  acceptUnknownPayload,
  createMessageNamespace,
  isPlainRecord,
  type Message,
  type MessageNamespace,
  type MessagePayloadValidator,
  type MessageTag,
} from './message';
import {
  createComposedMessageRouter,
  createMessageRouter,
  type ComposedMessageRouter,
  type MessageRouter,
} from './router';

const WARMUP_ITERS = 200_000;
const BENCH_ITERS = 2_000_000;

// ---------------------------------------------------------------------------
// Legacy implementation (verbatim copy of the previous router.ts) used only
// for side-by-side comparison. Keep this in sync if you change the public API.
// ---------------------------------------------------------------------------

const legacyValidation: Assert = Assert.validation();

type LegacyHandler<TState, TCtx, TOutput, P = unknown> = (
  state: TState,
  ctx: TCtx,
  msg: Message<P>
) => TOutput;

type LegacyRegistered<TState, TCtx, TOutput> = {
  validatePayload: MessagePayloadValidator<unknown>;
  handler: LegacyHandler<TState, TCtx, TOutput, unknown>;
};

class LegacyMessageRouterImpl<TState, TCtx, TOutput> implements MessageRouter<
  TState,
  TCtx,
  TOutput
> {
  private readonly handlers = new Map<
    string,
    LegacyRegistered<TState, TCtx, TOutput>
  >();
  constructor(private readonly namespace: MessageNamespace | undefined) {}
  on<P>(
    tag: MessageTag<P>,
    handler: LegacyHandler<TState, TCtx, TOutput, P>
  ): MessageRouter<TState, TCtx, TOutput> {
    if (this.namespace !== undefined) {
      legacyValidation.ok(
        this.namespace.owns({ type: tag.type, payload: {} }),
        `legacy: tag ${tag.type} not in namespace`
      );
    }
    this.handlers.set(tag.type, {
      validatePayload: tag.validatePayload as MessagePayloadValidator<unknown>,
      handler: handler as LegacyHandler<TState, TCtx, TOutput, unknown>,
    });
    return this;
  }
  has(msg: Message): boolean {
    if (this.namespace !== undefined && !this.namespace.owns(msg)) return false;
    return this.handlers.has(msg.type);
  }
  dispatch(
    state: TState,
    ctx: TCtx,
    msg: Message,
    fallback: (s: TState, c: TCtx, m: Message) => TOutput
  ): TOutput {
    if (this.namespace !== undefined && !this.namespace.owns(msg)) {
      return fallback(state, ctx, msg);
    }
    const entry = this.handlers.get(msg.type);
    if (entry === undefined) return fallback(state, ctx, msg);
    if (!entry.validatePayload(msg.payload)) {
      legacyValidation.fail(`legacy: invalid payload ${msg.type}`);
    }
    return entry.handler(state, ctx, msg as Message<unknown>);
  }
}

function legacyCreateMessageRouter<TState, TCtx, TOutput>(
  namespace?: MessageNamespace
): MessageRouter<TState, TCtx, TOutput> {
  return new LegacyMessageRouterImpl<TState, TCtx, TOutput>(namespace);
}

function legacyWirePrefix(type: string): string | undefined {
  const i = type.indexOf('/');
  if (i <= 0) return undefined;
  return type.slice(0, i);
}

function legacyCreateComposedMessageRouter<TState, TCtx, TOutput>(
  children: ReadonlyArray<{
    namespace: MessageNamespace;
    router: MessageRouter<TState, TCtx, TOutput>;
  }>
): ComposedMessageRouter<TState, TCtx, TOutput> {
  const byPrefix = new Map<string, MessageRouter<TState, TCtx, TOutput>>();
  for (const { namespace, router } of children) {
    byPrefix.set(namespace.prefix, router);
  }
  return {
    dispatch(state, ctx, msg, fallback) {
      const prefix = legacyWirePrefix(msg.type);
      if (prefix === undefined) return fallback(state, ctx, msg);
      const inner = byPrefix.get(prefix);
      if (inner === undefined) return fallback(state, ctx, msg);
      // The original allocated a closure on every dispatch.
      return inner.dispatch(state, ctx, msg, () => fallback(state, ctx, msg));
    },
    has(msg) {
      const prefix = legacyWirePrefix(msg.type);
      if (prefix === undefined) return false;
      const inner = byPrefix.get(prefix);
      return inner !== undefined && inner.has(msg);
    },
  };
}

// ---------------------------------------------------------------------------
// Bench harness
// ---------------------------------------------------------------------------

type BenchResult = {
  name: string;
  iters: number;
  totalMs: number;
  opsPerSec: number;
  nsPerOp: number;
};

function bench(
  name: string,
  fn: () => void,
  iters: number = BENCH_ITERS
): BenchResult {
  for (let i = 0; i < WARMUP_ITERS; i++) fn();
  if (typeof Bun !== 'undefined' && typeof Bun.gc === 'function') {
    Bun.gc(true);
  }
  const start = performance.now();
  for (let i = 0; i < iters; i++) fn();
  const totalMs = performance.now() - start;
  const opsPerSec = (iters / totalMs) * 1000;
  const nsPerOp = (totalMs * 1_000_000) / iters;
  return { name, iters, totalMs, opsPerSec, nsPerOp };
}

type Pair = { scenario: string; current: BenchResult; legacy: BenchResult };

function printPairs(pairs: Pair[]): void {
  const nameW = Math.max(20, ...pairs.map((p) => p.scenario.length));
  console.log(
    `\n${'scenario'.padEnd(nameW)}   ${'current ns/op'.padStart(14)}   ${'legacy ns/op'.padStart(13)}   ${'speedup'.padStart(8)}   ${'cur ops/s'.padStart(14)}   ${'leg ops/s'.padStart(14)}`
  );
  console.log('-'.repeat(nameW + 80));
  for (const p of pairs) {
    const speedup = p.legacy.nsPerOp / p.current.nsPerOp;
    console.log(
      `${p.scenario.padEnd(nameW)}   ${p.current.nsPerOp.toFixed(1).padStart(14)}   ${p.legacy.nsPerOp.toFixed(1).padStart(13)}   ${speedup.toFixed(2).padStart(7)}x   ${Math.round(p.current.opsPerSec).toLocaleString().padStart(14)}   ${Math.round(p.legacy.opsPerSec).toLocaleString().padStart(14)}`
    );
  }
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const game = createMessageNamespace('game');
const chat = createMessageNamespace('chat');
const sys = createMessageNamespace('sys');

type MovePayload = { cell: number; player: 'X' | 'O' };
const isMovePayload: MessagePayloadValidator<MovePayload> = (
  p
): p is MovePayload =>
  isPlainRecord(p) &&
  typeof p['cell'] === 'number' &&
  Number.isInteger(p['cell']) &&
  (p['player'] === 'X' || p['player'] === 'O');

const Move = game('move', isMovePayload);
const Resign = game('resign', acceptUnknownPayload);
const Chat = chat('say', acceptUnknownPayload);
const Heartbeat = sys('heartbeat', acceptUnknownPayload);

type State = { count: number };
type Ctx = { from: string };

function buildSingle<TR extends MessageRouter<State, Ctx, number>>(
  factory: (ns: MessageNamespace) => TR
): TR {
  return factory(game)
    .on(Move, (s, _c, m) => s.count + m.payload.cell)
    .on(Resign, (s) => s.count - 1) as TR;
}

function buildComposed(
  routerFactory: (ns: MessageNamespace) => MessageRouter<State, Ctx, number>,
  composeFactory: (
    children: ReadonlyArray<{
      namespace: MessageNamespace;
      router: MessageRouter<State, Ctx, number>;
    }>
  ) => ComposedMessageRouter<State, Ctx, number>
): ComposedMessageRouter<State, Ctx, number> {
  const gameRouter = routerFactory(game)
    .on(Move, (s, _c, m) => s.count + m.payload.cell)
    .on(Resign, (s) => s.count - 1);
  const chatRouter = routerFactory(chat).on(Chat, (s) => s.count + 1);
  const sysRouter = routerFactory(sys).on(Heartbeat, (s) => s.count);
  return composeFactory([
    { namespace: game, router: gameRouter },
    { namespace: chat, router: chatRouter },
    { namespace: sys, router: sysRouter },
  ]);
}

const state: State = { count: 0 };
const ctx: Ctx = { from: 'bench' };
const fallback = (s: State): number => s.count;

const moveMsg: Message = Move({ cell: 4, player: 'X' });
const chatMsg: Message = Chat({ text: 'hi' });
const heartbeatMsg: Message = Heartbeat({});
const unknownInGameMsg: Message = { type: 'game/ghost', payload: {} };
const outOfNamespaceMsg: Message = { type: 'other/x', payload: {} };

const currentSingle = buildSingle(createMessageRouter);
const legacySingle = buildSingle(legacyCreateMessageRouter);
const currentComposed = buildComposed(
  createMessageRouter,
  createComposedMessageRouter
);
const legacyComposed = buildComposed(
  legacyCreateMessageRouter,
  legacyCreateComposedMessageRouter
);

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

type Scenario = {
  name: string;
  current: () => void;
  legacy: () => void;
  iters?: number;
};

const scenarios: Scenario[] = [
  {
    name: 'single: hit (game/move)',
    current: () => {
      currentSingle.dispatch(state, ctx, moveMsg, fallback);
    },
    legacy: () => {
      legacySingle.dispatch(state, ctx, moveMsg, fallback);
    },
  },
  {
    name: 'single: miss in namespace',
    current: () => {
      currentSingle.dispatch(state, ctx, unknownInGameMsg, fallback);
    },
    legacy: () => {
      legacySingle.dispatch(state, ctx, unknownInGameMsg, fallback);
    },
  },
  {
    name: 'single: out of namespace',
    current: () => {
      currentSingle.dispatch(state, ctx, outOfNamespaceMsg, fallback);
    },
    legacy: () => {
      legacySingle.dispatch(state, ctx, outOfNamespaceMsg, fallback);
    },
  },
  {
    name: 'composed: hit first child',
    current: () => {
      currentComposed.dispatch(state, ctx, moveMsg, fallback);
    },
    legacy: () => {
      legacyComposed.dispatch(state, ctx, moveMsg, fallback);
    },
  },
  {
    name: 'composed: hit middle child',
    current: () => {
      currentComposed.dispatch(state, ctx, chatMsg, fallback);
    },
    legacy: () => {
      legacyComposed.dispatch(state, ctx, chatMsg, fallback);
    },
  },
  {
    name: 'composed: hit last child',
    current: () => {
      currentComposed.dispatch(state, ctx, heartbeatMsg, fallback);
    },
    legacy: () => {
      legacyComposed.dispatch(state, ctx, heartbeatMsg, fallback);
    },
  },
  {
    name: 'composed: no prefix match',
    current: () => {
      currentComposed.dispatch(state, ctx, outOfNamespaceMsg, fallback);
    },
    legacy: () => {
      legacyComposed.dispatch(state, ctx, outOfNamespaceMsg, fallback);
    },
  },
  {
    name: 'mixed traffic (4 msgs)',
    iters: BENCH_ITERS / 4,
    current: () => {
      currentComposed.dispatch(state, ctx, moveMsg, fallback);
      currentComposed.dispatch(state, ctx, chatMsg, fallback);
      currentComposed.dispatch(state, ctx, heartbeatMsg, fallback);
      currentComposed.dispatch(state, ctx, outOfNamespaceMsg, fallback);
    },
    legacy: () => {
      legacyComposed.dispatch(state, ctx, moveMsg, fallback);
      legacyComposed.dispatch(state, ctx, chatMsg, fallback);
      legacyComposed.dispatch(state, ctx, heartbeatMsg, fallback);
      legacyComposed.dispatch(state, ctx, outOfNamespaceMsg, fallback);
    },
  },
];

// Run pairs interleaved to reduce systematic bias from JIT warmup ordering.
const pairs: Pair[] = [];
for (const s of scenarios) {
  // Two passes per scenario, alternating order; take the better of each.
  const a1 = bench(`${s.name}::current/A`, s.current, s.iters ?? BENCH_ITERS);
  const b1 = bench(`${s.name}::legacy/A`, s.legacy, s.iters ?? BENCH_ITERS);
  const b2 = bench(`${s.name}::legacy/B`, s.legacy, s.iters ?? BENCH_ITERS);
  const a2 = bench(`${s.name}::current/B`, s.current, s.iters ?? BENCH_ITERS);
  const current = a1.nsPerOp <= a2.nsPerOp ? a1 : a2;
  const legacy = b1.nsPerOp <= b2.nsPerOp ? b1 : b2;
  pairs.push({ scenario: s.name, current, legacy });
}

printPairs(pairs);

const aggregateSpeedup =
  pairs.reduce((acc, p) => acc + p.legacy.nsPerOp / p.current.nsPerOp, 0) /
  pairs.length;
console.log(
  `\naverage speedup across scenarios: ${aggregateSpeedup.toFixed(2)}x\n`
);
