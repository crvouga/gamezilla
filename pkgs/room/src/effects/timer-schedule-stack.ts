import type { Clock, Timers } from '@pkgs/clock';
import type { Message } from '@pkgs/message';
import type { CreateId } from '@pkgs/uuid';

import type { RoomEffectHandler } from './handler';
import {
  createScheduleEffectHandler,
  createTimerWakePort,
  fireDueSchedules,
  ScheduleRuntime,
} from './schedule-runtime';

export type TimerScheduleStack = {
  readonly runtime: ScheduleRuntime;
  readonly handler: RoomEffectHandler;
  readonly dispose: () => void;
};

/**
 * Memory schedule runtime + timer wake + built-in Schedule handler.
 * Call {@link bindInject} once the host can inject commands (server/client).
 */
export function createTimerScheduleStack(args: {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly topic: string;
  /** Optional: serialize wake work (e.g. harness serverQueue.enqueue). */
  readonly enqueueWake?: (work: () => Promise<void>) => void;
}): TimerScheduleStack & {
  readonly bindInject: (
    injectCommand: (args: {
      readonly id: string;
      readonly payload: Message;
      readonly identity: string;
    }) => void | Promise<void>
  ) => void;
} {
  let inject:
    | ((args: {
        readonly id: string;
        readonly payload: Message;
        readonly identity: string;
      }) => void | Promise<void>)
    | null = null;

  const runWake = async (): Promise<void> => {
    if (inject === null) return;
    await fireDueSchedules({
      runtime,
      createId: args.createId,
      ctx: {
        topic: args.topic,
        clock: args.clock,
        now: args.clock.now(),
        injectCommand: inject,
      },
    });
  };

  const wakePort = createTimerWakePort({
    clock: args.clock,
    timers: args.timers,
    onWake: () => {
      if (args.enqueueWake !== undefined) {
        args.enqueueWake(() => runWake());
        return;
      }
      void runWake();
    },
  });

  const runtime = new ScheduleRuntime(wakePort);
  const handler = createScheduleEffectHandler({
    runtime,
    createId: args.createId,
  });

  return {
    runtime,
    handler,
    dispose: () => wakePort.dispose(),
    bindInject: (fn) => {
      inject = fn;
    },
  };
}
