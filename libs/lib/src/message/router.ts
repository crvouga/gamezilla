import { Assert } from '@gamezilla/lib/assert'
import type { Message, MessagePayloadValidator, MessageTag } from './message'

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

class MessageRouterImpl<TState, TCtx, TOutput>
  implements MessageRouter<TState, TCtx, TOutput>
{
  private readonly handlers = new Map<string, RegisteredHandler<TState, TCtx, TOutput>>()

  on<P>(
    tag: MessageTag<P>,
    handler: Handler<TState, TCtx, TOutput, P>,
  ): MessageRouter<TState, TCtx, TOutput> {
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
    return this.handlers.has(msg.type)
  }

  dispatch(
    state: TState,
    ctx: TCtx,
    msg: Message,
    fallback: (state: TState, ctx: TCtx, msg: Message) => TOutput,
  ): TOutput {
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

export function createMessageRouter<
  TState,
  TCtx,
  TOutput,
>(): MessageRouter<TState, TCtx, TOutput> {
  return new MessageRouterImpl<TState, TCtx, TOutput>()
}
