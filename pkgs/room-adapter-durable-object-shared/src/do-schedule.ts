import type { Clock } from '@pkgs/clock-shared/types';
import type { Message } from '@pkgs/message-shared/message';
import { isMessageEnvelope, isPlainRecord } from '@pkgs/message-shared/message';
import {
  CancelScheduleEffect,
  ScheduleEffect,
} from '@pkgs/room-shared/builtin';
import type { RoomEffectHandler } from '@pkgs/room-shared/handler';
import type {
  PendingSchedule,
  ScheduleWakePort,
} from '@pkgs/room-shared/schedule-runtime';
import {
  createScheduleEffectHandler,
  fireDueSchedules,
  ScheduleRuntime,
} from '@pkgs/room-shared/schedule-runtime';
import type { RoomEffect, RoomModuleName } from '@pkgs/room-shared/types';
import type { CreateId } from '@pkgs/uuid-shared/create-id';
import { roomDoKeyNs, scheduleKey } from './storage-keys';
import type { DurableObjectKvStorage } from './types';

function isPendingSchedule(v: unknown): v is PendingSchedule {
  if (!isPlainRecord(v)) return false;
  return (
    typeof v['id'] === 'string' &&
    typeof v['at'] === 'number' &&
    Number.isInteger(v['at']) &&
    isMessageEnvelope(v['payload'])
  );
}

/** Arms the DO's single alarm to the earliest pending `at` across modules. */
export class DoAlarmHub {
  private readonly earliestByModule = new Map<string, number | null>();

  constructor(private readonly storage: DurableObjectKvStorage) {}

  async setModuleEarliest(
    moduleName: string,
    at: number | null
  ): Promise<void> {
    this.earliestByModule.set(moduleName, at);
    await this.rearm();
  }

  private async rearm(): Promise<void> {
    let earliest: number | null = null;
    for (const at of this.earliestByModule.values()) {
      if (at === null) continue;
      if (earliest === null || at < earliest) earliest = at;
    }
    if (earliest === null) {
      await this.storage.deleteAlarm?.();
      return;
    }
    await this.storage.setAlarm?.(earliest);
  }
}

export function createDoScheduleWakePort(args: {
  readonly hub: DoAlarmHub;
  readonly moduleName: string;
}): ScheduleWakePort {
  return {
    arm: (at) => args.hub.setModuleEarliest(args.moduleName, at),
  };
}

export async function loadPendingSchedules(
  storage: DurableObjectKvStorage,
  moduleName: RoomModuleName
): Promise<PendingSchedule[]> {
  const ns = roomDoKeyNs(moduleName);
  const listed = await storage.list<unknown>({ prefix: ns.schedulePrefix });
  const out: PendingSchedule[] = [];
  for (const [key, value] of listed) {
    const id = key.slice(ns.schedulePrefix.length);
    if (id.length === 0) continue;
    if (!isPendingSchedule(value)) continue;
    out.push({ id, at: value.at, payload: value.payload });
  }
  return out;
}

export async function persistScheduleUpsert(
  storage: DurableObjectKvStorage,
  moduleName: RoomModuleName,
  entry: PendingSchedule
): Promise<void> {
  const ns = roomDoKeyNs(moduleName);
  await storage.put(scheduleKey(ns, entry.id), {
    id: entry.id,
    at: entry.at,
    payload: entry.payload,
  });
}

export async function persistScheduleCancel(
  storage: DurableObjectKvStorage,
  moduleName: RoomModuleName,
  id: string
): Promise<void> {
  const ns = roomDoKeyNs(moduleName);
  await storage.delete(scheduleKey(ns, id));
}

/**
 * Schedule handler that mirrors pending entries into DO KV, then updates the
 * in-memory {@link ScheduleRuntime}.
 */
export function createPersistingScheduleEffectHandler(args: {
  readonly storage: DurableObjectKvStorage;
  readonly moduleName: RoomModuleName;
  readonly runtime: ScheduleRuntime;
  readonly createId: CreateId;
}): RoomEffectHandler {
  const inner = createScheduleEffectHandler({
    runtime: args.runtime,
    createId: args.createId,
  });
  return {
    apply: async (effect: RoomEffect, ctx) => {
      if (ScheduleEffect.is(effect)) {
        await persistScheduleUpsert(args.storage, args.moduleName, {
          id: effect.payload.id,
          at: effect.payload.at,
          payload: effect.payload.payload,
        });
      } else if (CancelScheduleEffect.is(effect)) {
        await persistScheduleCancel(
          args.storage,
          args.moduleName,
          effect.payload.id
        );
      }
      return inner.apply(effect, ctx);
    },
  };
}

export async function openDoModuleSchedule(args: {
  readonly storage: DurableObjectKvStorage;
  readonly moduleName: RoomModuleName;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly hub: DoAlarmHub;
  readonly topic: string;
  readonly injectCommand: (cmd: {
    readonly id: string;
    readonly payload: Message;
    readonly identity: string;
  }) => void | Promise<void>;
}): Promise<{
  readonly runtime: ScheduleRuntime;
  readonly handler: RoomEffectHandler;
  readonly fireDue: () => Promise<void>;
}> {
  const wake = createDoScheduleWakePort({
    hub: args.hub,
    moduleName: String(args.moduleName),
  });
  const runtime = new ScheduleRuntime(wake);
  await runtime.replaceAll(
    await loadPendingSchedules(args.storage, args.moduleName)
  );
  const handler = createPersistingScheduleEffectHandler({
    storage: args.storage,
    moduleName: args.moduleName,
    runtime,
    createId: args.createId,
  });
  const fireDue = async (): Promise<void> => {
    await fireDueSchedules({
      runtime,
      createId: args.createId,
      ctx: {
        topic: args.topic,
        clock: args.clock,
        now: args.clock.now(),
        injectCommand: args.injectCommand,
      },
    });
    const ns = roomDoKeyNs(args.moduleName);
    const listed = await args.storage.list({ prefix: ns.schedulePrefix });
    const live = new Set(runtime.list().map((e) => e.id));
    for (const key of listed.keys()) {
      const id = key.slice(ns.schedulePrefix.length);
      if (!live.has(id)) await args.storage.delete(key);
    }
  };
  return { runtime, handler, fireDue };
}
