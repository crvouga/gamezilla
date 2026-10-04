import type { Clock, Timers } from '@pkgs/clock-shared/types';
import type { Message } from '@pkgs/message-shared/message';
import type { CreateId } from '@pkgs/uuid-shared/create-id';

import type { RoomEffect } from './types';
import {
  CancelScheduleEffect,
  ROOM_SCHEDULER_IDENTITY,
  ScheduleEffect,
} from './builtin';
import type { RoomEffectContext, RoomEffectHandler } from './handler';

export type PendingSchedule = {
  readonly id: string;
  readonly at: number;
  readonly payload: Message;
};

export type ScheduleWakePort = {
  /** Arm a wake at absolute epoch ms (or clear when `at` is null). */
  readonly arm: (at: number | null) => void | Promise<void>;
};

/**
 * In-memory pending schedules + earliest-wake arming. DO persistence wraps
 * this and syncs KV on mutate; harness/client use {@link createTimerWakePort}.
 */
export class ScheduleRuntime {
  private readonly pending = new Map<string, PendingSchedule>();
  private armedAt: number | null = null;

  constructor(private readonly wake: ScheduleWakePort) {}

  list(): readonly PendingSchedule[] {
    return [...this.pending.values()].sort(
      (a, b) => a.at - b.at || (a.id < b.id ? -1 : 1)
    );
  }

  /** Earliest pending entry without sorting (O(n), no allocation). */
  private earliest(): PendingSchedule | undefined {
    let best: PendingSchedule | undefined;
    for (const e of this.pending.values()) {
      if (
        best === undefined ||
        e.at < best.at ||
        (e.at === best.at && e.id < best.id)
      ) {
        best = e;
      }
    }
    return best;
  }

  get(id: string): PendingSchedule | undefined {
    return this.pending.get(id);
  }

  async upsert(entry: PendingSchedule): Promise<void> {
    this.pending.set(entry.id, entry);
    await this.rearm();
  }

  async cancel(id: string): Promise<void> {
    if (!this.pending.delete(id)) return;
    await this.rearm();
  }

  /** Replace all pending (e.g. hydrate from KV). */
  async replaceAll(entries: readonly PendingSchedule[]): Promise<void> {
    this.pending.clear();
    for (const e of entries) this.pending.set(e.id, e);
    await this.rearm();
  }

  /**
   * Fire all due schedules (`at <= now`), returning them for inject.
   * Caller must inject then call {@link rearm}.
   */
  takeDue(now: number): PendingSchedule[] {
    const due: PendingSchedule[] = [];
    for (const e of this.list()) {
      if (e.at > now) break;
      due.push(e);
      this.pending.delete(e.id);
    }
    return due;
  }

  async rearm(): Promise<void> {
    const next = this.earliest();
    const at = next === undefined ? null : next.at;
    if (at === this.armedAt) return;
    this.armedAt = at;
    await this.wake.arm(at);
  }

  earliestAt(): number | null {
    return this.earliest()?.at ?? null;
  }
}

/** Timer-based wake for client + harness (uses injected Timers + Clock). */
export function createTimerWakePort(args: {
  readonly clock: Clock;
  readonly timers: Timers;
  readonly onWake: () => void | Promise<void>;
}): ScheduleWakePort & { readonly dispose: () => void } {
  let handle: unknown = null;
  const clear = (): void => {
    if (handle !== null) {
      args.timers.clearTimeout(handle);
      handle = null;
    }
  };
  return {
    arm: (at) => {
      clear();
      if (at === null) return;
      const delay = Math.max(0, at - args.clock.now());
      handle = args.timers.setTimeout(() => {
        handle = null;
        void args.onWake();
      }, delay);
    },
    dispose: clear,
  };
}

export function createScheduleEffectHandler(args: {
  readonly runtime: ScheduleRuntime;
  readonly createId: CreateId;
}): RoomEffectHandler {
  return {
    apply: async (effect: RoomEffect, ctx: RoomEffectContext) => {
      if (ScheduleEffect.is(effect)) {
        await args.runtime.upsert({
          id: effect.payload.id,
          at: effect.payload.at,
          payload: effect.payload.payload,
        });
        return true;
      }
      if (CancelScheduleEffect.is(effect)) {
        await args.runtime.cancel(effect.payload.id);
        return true;
      }
      void ctx;
      return false;
    },
  };
}

/** Fire due schedules through injectCommand as {@link ROOM_SCHEDULER_IDENTITY}. */
export async function fireDueSchedules(args: {
  readonly runtime: ScheduleRuntime;
  readonly createId: CreateId;
  readonly ctx: RoomEffectContext;
}): Promise<void> {
  const due = args.runtime.takeDue(args.ctx.now);
  let index = 0;
  try {
    // The old wake has fired. Rearm before an injected command can restore
    // the same deadline, so its replacement does not reuse a consumed wake.
    await args.runtime.rearm();
    for (; index < due.length; index++) {
      const entry = due[index]!;
      await args.ctx.injectCommand({
        id: args.createId(),
        payload: entry.payload,
        identity: ROOM_SCHEDULER_IDENTITY,
      });
    }
  } catch (error) {
    for (; index < due.length; index++) {
      const entry = due[index]!;
      // Recovery may already have replaced this deadline from current state.
      if (args.runtime.get(entry.id) === undefined)
        await args.runtime.upsert(entry);
    }
    throw error;
  } finally {
    await args.runtime.rearm();
  }
}
