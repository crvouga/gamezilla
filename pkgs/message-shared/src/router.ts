import { Assert } from '@pkgs/assert-shared/assert';
import { hotAssert } from '@pkgs/assert-shared/hot-asserts';
import type {
  Message,
  MessageNamespace,
  MessagePayloadValidator,
  MessageTag,
} from './message';
import { assertMessageEnvelope } from './message';

const validation: Assert = Assert.validation();

type Handler<TState, TCtx, TOutput, P = unknown> = (
  state: TState,
  ctx: TCtx,
  msg: Message<P>
) => TOutput;

/**
 * Validator + handler fused into a single call site at registration time so
 * `dispatch` is one `Map.get` + one indirect call instead of fetching an entry
 * object and dereferencing two fields per message.
 */
type CompiledHandler<TState, TCtx, TOutput> = (
  state: TState,
  ctx: TCtx,
  msg: Message
) => TOutput;

/**
 * Dispatches a {@link Message} to a handler registered by {@link MessageTag}.
 * Replaces brittle `switch (msg.type)` with composable registration.
 *
 * When constructed with a {@link MessageNamespace}, {@link dispatch} and {@link has}
 * short-circuit for messages outside that namespace via a single `startsWith`.
 */
export interface MessageRouter<TState, TCtx, TOutput> {
  on<P>(
    tag: MessageTag<P>,
    handler: Handler<TState, TCtx, TOutput, P>
  ): MessageRouter<TState, TCtx, TOutput>;
  dispatch(
    state: TState,
    ctx: TCtx,
    msg: Message,
    fallback: (state: TState, ctx: TCtx, msg: Message) => TOutput
  ): TOutput;
  has(msg: Message): boolean;
}

/**
 * O(N) prefix routing over several namespaced {@link MessageRouter}s, where N
 * is the number of children (typically a handful). Uses {@link createComposedMessageRouter};
 * this type has no {@link MessageRouter.on}.
 */
export interface ComposedMessageRouter<TState, TCtx, TOutput> {
  dispatch(
    state: TState,
    ctx: TCtx,
    msg: Message,
    fallback: (state: TState, ctx: TCtx, msg: Message) => TOutput
  ): TOutput;
  has(msg: Message): boolean;
}

class MessageRouterImpl<TState, TCtx, TOutput>
  implements MessageRouter<TState, TCtx, TOutput>
{
  private readonly handlers = new Map<
    string,
    CompiledHandler<TState, TCtx, TOutput>
  >();
  /** Pre-built `${prefix}/` so the dispatch hot path is a direct `startsWith`. */
  private readonly prefixSlash: string | undefined;
  private readonly namespacePrefix: string | undefined;

  constructor(namespace: MessageNamespace | undefined) {
    if (namespace !== undefined) {
      this.namespacePrefix = namespace.prefix;
      this.prefixSlash = `${namespace.prefix}/`;
    } else {
      this.namespacePrefix = undefined;
      this.prefixSlash = undefined;
    }
  }

  on<P>(
    tag: MessageTag<P>,
    handler: Handler<TState, TCtx, TOutput, P>
  ): MessageRouter<TState, TCtx, TOutput> {
    const ps = this.prefixSlash;
    if (ps !== undefined) {
      validation.ok(
        tag.type.startsWith(ps),
        `message tag ${tag.type} is not in router namespace ${this.namespacePrefix}`
      );
    }
    validation.ok(
      !this.handlers.has(tag.type),
      `duplicate message router registration for type: ${tag.type}`
    );

    const fullType = tag.type;
    const validatePayload =
      tag.validatePayload as MessagePayloadValidator<unknown>;
    const typedHandler = handler as Handler<TState, TCtx, TOutput, unknown>;
    const compiled: CompiledHandler<TState, TCtx, TOutput> = (
      state,
      ctx,
      msg
    ) => {
      if (!validatePayload(msg.payload)) {
        validation.fail(`invalid payload for routed message type ${fullType}`, {
          type: fullType,
          payload: msg.payload,
        });
      }
      return typedHandler(state, ctx, msg as Message<unknown>);
    };
    this.handlers.set(fullType, compiled);
    return this;
  }

  has(msg: Message): boolean {
    assertMessageEnvelope(hotAssert(), msg);
    const ps = this.prefixSlash;
    if (ps !== undefined && !msg.type.startsWith(ps)) {
      return false;
    }
    return this.handlers.has(msg.type);
  }

  dispatch(
    state: TState,
    ctx: TCtx,
    msg: Message,
    fallback: (state: TState, ctx: TCtx, msg: Message) => TOutput
  ): TOutput {
    assertMessageEnvelope(hotAssert(), msg);
    const ps = this.prefixSlash;
    if (ps !== undefined && !msg.type.startsWith(ps)) {
      return fallback(state, ctx, msg);
    }
    const compiled = this.handlers.get(msg.type);
    if (compiled === undefined) {
      return fallback(state, ctx, msg);
    }
    return compiled(state, ctx, msg);
  }
}

/**
 * Creates a message router. Pass a {@link MessageNamespace} from {@link createMessageNamespace}
 * so only types under that prefix are registered and considered by {@link MessageRouter.dispatch}.
 */
export function createMessageRouter<TState, TCtx, TOutput>(
  namespace?: MessageNamespace
): MessageRouter<TState, TCtx, TOutput> {
  return new MessageRouterImpl<TState, TCtx, TOutput>(namespace);
}

/**
 * Routes `msg` to the child whose {@link MessageNamespace.prefix} matches the wire
 * prefix of `msg.type` (segment before `/`). Each child should usually be a namespaced
 * router from {@link createMessageRouter}(ns).
 *
 * For typical N (a handful of namespaces), a parallel-array `startsWith` scan beats a
 * `slice` + `Map.get` lookup because it avoids per-dispatch substring allocation.
 */
export function createComposedMessageRouter<TState, TCtx, TOutput>(
  children: ReadonlyArray<{
    namespace: MessageNamespace;
    router: MessageRouter<TState, TCtx, TOutput>;
  }>
): ComposedMessageRouter<TState, TCtx, TOutput> {
  const seen = new Set<string>();
  const prefixes: string[] = [];
  const routers: MessageRouter<TState, TCtx, TOutput>[] = [];
  for (const { namespace, router } of children) {
    validation.ok(
      !seen.has(namespace.prefix),
      `duplicate composed router namespace prefix: ${namespace.prefix}`
    );
    seen.add(namespace.prefix);
    prefixes.push(`${namespace.prefix}/`);
    routers.push(router);
  }
  const n = prefixes.length;

  return {
    dispatch(state, ctx, msg, fallback) {
      assertMessageEnvelope(hotAssert(), msg);
      const type = msg.type;
      for (let i = 0; i < n; i++) {
        if (type.startsWith(prefixes[i]!)) {
          return routers[i]!.dispatch(state, ctx, msg, fallback);
        }
      }
      return fallback(state, ctx, msg);
    },
    has(msg) {
      assertMessageEnvelope(hotAssert(), msg);
      const type = msg.type;
      for (let i = 0; i < n; i++) {
        if (type.startsWith(prefixes[i]!)) {
          return routers[i]!.has(msg);
        }
      }
      return false;
    },
  };
}
