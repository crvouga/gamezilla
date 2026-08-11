import type { Clock } from '@pkgs/clock';
import type { Message } from '@pkgs/message';

import type { RoomEffect } from '../types';

export type RoomEffectContext = {
  readonly topic: string;
  readonly clock: Clock;
  readonly now: number;
  /** Fire a command through the host handle/commit (server) or dispatch (client). */
  readonly injectCommand: (args: {
    readonly id: string;
    readonly payload: Message;
    readonly identity: string;
  }) => void | Promise<void>;
};

/**
 * Applies one effect after a successful handle. Return `true` when this
 * handler claimed the effect. Unknown effects with no claim fail loudly.
 */
export type RoomEffectHandler = {
  readonly apply: (
    effect: RoomEffect,
    ctx: RoomEffectContext
  ) => boolean | Promise<boolean>;
};

export async function applyRoomEffects(
  effects: readonly RoomEffect[],
  handlers: readonly RoomEffectHandler[],
  ctx: RoomEffectContext
): Promise<void> {
  for (const effect of effects) {
    let handled = false;
    for (const handler of handlers) {
      if (await handler.apply(effect, ctx)) {
        handled = true;
        break;
      }
    }
    if (!handled) {
      throw new Error(
        `Tiger: no RoomEffectHandler for effect type=${String(
          (effect as { type?: unknown }).type
        )}`
      );
    }
  }
}
