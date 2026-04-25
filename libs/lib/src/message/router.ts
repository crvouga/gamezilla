import { Assert } from '@gamezilla/lib/assert'
import type {
  Message,
  MessageNamespace,
  MessagePayloadValidator,
  MessageTag,
} from './message'

const validation: Assert = Assert.validation()

type Handler<TState, TCtx, TOutput, P = unknown> = (
  state: TState,
  ctx: TCtx,
  msg: Message<P>,
) => TOutput

type RegisteredHandler<TState, TCtx, TOutput> = {
  validatePayload: MessagePayloadValidator<unknown>
  handler: Handler<TState, TCtx, TOutput, unknown>
}

/**
 * Dispatches a {@link Message} to a handler registered by {@link MessageTag}.
 * Replaces brittle `switch (msg.type)` with composable registration.
 *
 * When constructed with a {@link MessageNamespace}, {@link dispatch} and {@link has}
 * short-circuit for messages outside that namespace (O(1) via `namespace.owns`).
 */
export interface MessageRouter<TState, TCtx, TOutput> {
  on<P>(
    tag: MessageTag<P>,
    handler: Handler<TState, TCtx, TOutput, P>,
  ): MessageRouter<TState, TCtx, TOutput>
  dispatch(
    state: TState,
    ctx: TCtx,
    msg: Message,
    fallback: (state: TState, ctx: TCtx, msg: Message) => TOutput,
  ): TOutput
  has(msg: Message): boolean
}

/**
 * O(1) prefix routing over several namespaced {@link MessageRouter}s.
 * Use {@link createComposedMessageRouter}; this type has no {@link MessageRouter.on}.
 */
export interface ComposedMessageRouter<TState, TCtx, TOutput> {
  dispatch(
    state: TState,
    ctx: TCtx,
    msg: Message,
    fallback: (state: TState, ctx: TCtx, msg: Message) => TOutput,
  ): TOutput
  has(msg: Message): boolean
}

class MessageRouterImpl<TState, TCtx, TOutput>
  implements MessageRouter<TState, TCtx, TOutput>
{
  private readonly handlers = new Map<string, RegisteredHandler<TState, TCtx, TOutput>>()

  constructor(private readonly namespace: MessageNamespace | undefined) {}

  on<P>(
    tag: MessageTag<P>,
    handler: Handler<TState, TCtx, TOutput, P>,
  ): MessageRouter<TState, TCtx, TOutput> {
    if (this.namespace !== undefined) {
      validation.ok(
        this.namespace.owns({ type: tag.type, payload: {} }),
        `message tag ${tag.type} is not in router namespace ${this.namespace.prefix}`,
      )
    }
    validation.ok(
      !this.handlers.has(tag.type),
      `duplicate message router registration for type: ${tag.type}`,
    )
    this.handlers.set(tag.type, {
      validatePayload: tag.validatePayload as MessagePayloadValidator<unknown>,
      handler: handler as Handler<TState, TCtx, TOutput, unknown>,
    })
    return this
  }

  has(msg: Message): boolean {
    if (this.namespace !== undefined && !this.namespace.owns(msg)) {
      return false
    }
    return this.handlers.has(msg.type)
  }

  dispatch(
    state: TState,
    ctx: TCtx,
    msg: Message,
    fallback: (state: TState, ctx: TCtx, msg: Message) => TOutput,
  ): TOutput {
    if (this.namespace !== undefined && !this.namespace.owns(msg)) {
      return fallback(state, ctx, msg)
    }
    const entry = this.handlers.get(msg.type)
    if (entry === undefined) {
      return fallback(state, ctx, msg)
    }
    if (!entry.validatePayload(msg.payload)) {
      validation.fail(`invalid payload for routed message type ${msg.type}`, {
        type: msg.type,
        payload: msg.payload,
      })
    }
    return entry.handler(state, ctx, msg as Message<unknown>)
  }
}

/**
 * Creates a message router. Pass a {@link MessageNamespace} from {@link createNamespace}
 * so only types under that prefix are registered and considered by {@link MessageRouter.dispatch}.
 */
export function createMessageRouter<TState, TCtx, TOutput>(
  namespace?: MessageNamespace,
): MessageRouter<TState, TCtx, TOutput> {
  return new MessageRouterImpl<TState, TCtx, TOutput>(namespace)
}

/** First path segment of `type` (before `/`), matching namespace `prefix` in `prefix/name`. */
function wirePrefixFromMessageType(type: string): string | undefined {
  const i = type.indexOf('/')
  if (i <= 0) {
    return undefined
  }
  return type.slice(0, i)
}

/**
 * Routes `msg` to the child whose {@link MessageNamespace.prefix} matches the wire prefix
 * of `msg.type` (segment before `/`). Each child should usually be a namespaced router from
 * {@link createMessageRouter}(ns).
 */
export function createComposedMessageRouter<TState, TCtx, TOutput>(
  children: ReadonlyArray<{
    namespace: MessageNamespace
    router: MessageRouter<TState, TCtx, TOutput>
  }>,
): ComposedMessageRouter<TState, TCtx, TOutput> {
  const byPrefix = new Map<string, MessageRouter<TState, TCtx, TOutput>>()
  for (const { namespace, router } of children) {
    validation.ok(
      !byPrefix.has(namespace.prefix),
      `duplicate composed router namespace prefix: ${namespace.prefix}`,
    )
    byPrefix.set(namespace.prefix, router)
  }

  return {
    dispatch(state, ctx, msg, fallback) {
      const prefix = wirePrefixFromMessageType(msg.type)
      if (prefix === undefined) {
        return fallback(state, ctx, msg)
      }
      const inner = byPrefix.get(prefix)
      if (inner === undefined) {
        return fallback(state, ctx, msg)
      }
      return inner.dispatch(state, ctx, msg, () => fallback(state, ctx, msg))
    },
    has(msg) {
      const prefix = wirePrefixFromMessageType(msg.type)
      if (prefix === undefined) {
        return false
      }
      const inner = byPrefix.get(prefix)
      return inner !== undefined && inner.has(msg)
    },
  }
}
