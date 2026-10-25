import { Assert } from '@pkgs/assert-root-shared-ts/assert';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import {
  applyRoomEffects,
  type RoomEffectContext,
  type RoomEffectHandler,
} from '@pkgs/room-root-shared-ts/handler';
import type { RoomEffect } from '@pkgs/room-root-shared-ts/types';

const crash: Assert = Assert.crash();

/** Bind committed effect delivery once to the host's injected clock and command path. */
export function createRoomEffectDelivery(args: {
  readonly handlers: readonly RoomEffectHandler[];
  readonly topic: string;
  readonly clock: Clock;
  readonly injectCommand: RoomEffectContext['injectCommand'];
}): (effects: readonly RoomEffect[]) => Promise<void> {
  return async (effects) => {
    if (effects.length === 0) return;
    crash.ok(
      args.handlers.length > 0,
      'Tiger: handle produced effects but RoomServer has no effectHandlers',
      { count: effects.length }
    );
    await applyRoomEffects(effects, args.handlers, {
      topic: args.topic,
      clock: args.clock,
      now: args.clock.now(),
      injectCommand: args.injectCommand,
    });
  };
}
