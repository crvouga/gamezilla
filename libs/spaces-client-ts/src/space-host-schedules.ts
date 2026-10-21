import type { Clock, Timers } from '@pkgs/clock-shared-ts/types';
import type { RoomClient } from '@pkgs/room-root-client-ts/room-client';
import { ScheduleEffect } from '@pkgs/room-root-shared-ts/builtin';
import { createTimerScheduleStack } from '@pkgs/room-root-shared-ts/timer-schedule-stack';
import type {
  RoomCommandPayload,
  RoomEvent,
  RoomState,
} from '@pkgs/room-root-shared-ts/types';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { SpaceRoomModule } from './space-module-context';

/** Recover schedules from local state, including after an offline app restart. */
export function startSpaceHostSchedules(
  room: RoomClient<RoomState, RoomCommandPayload, RoomEvent, string>,
  module: SpaceRoomModule,
  ports: { clock: Clock; timers: Timers; createId: CreateId; topic: string }
): () => void {
  const stack = createTimerScheduleStack(ports);
  stack.bindInject(({ payload }) => {
    room.dispatch(
      module.prepareLocalCommand(room.getSnapshot(), payload, ports.clock.now())
    );
  });
  const recover = (): void => {
    const entries = module
      .recoverLocalEffects(room.getSnapshot())
      .flatMap((effect) => (ScheduleEffect.is(effect) ? [effect.payload] : []));
    void stack.runtime.replaceAll(entries);
  };
  const unsubscribe = room.subscribe(recover);
  recover();
  return () => {
    unsubscribe();
    stack.dispose();
  };
}
