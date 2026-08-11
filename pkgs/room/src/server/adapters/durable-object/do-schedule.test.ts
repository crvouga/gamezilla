import { describe, expect, test } from 'bun:test';
import type { Clock } from '@pkgs/clock';
import { createMessageNamespace, isPlainRecord } from '@pkgs/message';
import { ScheduleEffect } from '../../../effects/builtin';
import { applyRoomEffects } from '../../../effects/handler';
import { assertRoomModuleName } from '../../../types';

import {
  DoAlarmHub,
  loadPendingSchedules,
  openDoModuleSchedule,
} from './do-schedule';
import type {
  DurableObjectKvListOptions,
  DurableObjectKvStorage,
} from './types';

function missesPrefix(k: string, prefix: string | undefined): boolean {
  return prefix !== undefined && !k.startsWith(prefix);
}

class MemoryDoKvWithAlarm implements DurableObjectKvStorage {
  readonly map = new Map<string, unknown>();
  alarmAt: number | null = null;

  async get<T = unknown>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }

  async put(
    keyOrEntries: string | Record<string, unknown>,
    value?: unknown
  ): Promise<void> {
    if (typeof keyOrEntries === 'string') {
      this.map.set(keyOrEntries, value);
      return;
    }
    for (const [k, v] of Object.entries(keyOrEntries)) {
      this.map.set(k, v);
    }
  }

  async delete(key: string): Promise<boolean> {
    return this.map.delete(key);
  }

  async list<T = unknown>(
    options?: DurableObjectKvListOptions
  ): Promise<Map<string, T>> {
    const keys = [...this.map.keys()].sort();
    const out = new Map<string, T>();
    for (const k of keys) {
      if (missesPrefix(k, options?.prefix)) continue;
      out.set(k, this.map.get(k) as T);
      if (options?.limit !== undefined && out.size >= options.limit) break;
    }
    return out;
  }

  async setAlarm(ms: number): Promise<void> {
    this.alarmAt = ms;
  }

  async getAlarm(): Promise<number | null> {
    return this.alarmAt;
  }

  async deleteAlarm(): Promise<void> {
    this.alarmAt = null;
  }
}

const tickNs = createMessageNamespace('do-sched-test');
const Tick = tickNs(
  'tick',
  (p): p is Record<string, never> =>
    isPlainRecord(p) && Object.keys(p).length === 0
);

describe('DO schedule + alarm', () => {
  test('Schedule persists, arms alarm, fireDue injects and clears KV', async () => {
    const kv = new MemoryDoKvWithAlarm();
    let now = 1_000;
    const clock: Clock = { now: () => now };
    const moduleName = assertRoomModuleName('counter');
    const injected: string[] = [];
    let nextId = 0;
    const createId = (): string => `cmd-${String((nextId += 1))}`;

    const hub = new DoAlarmHub(kv);
    const schedule = await openDoModuleSchedule({
      storage: kv,
      moduleName,
      clock,
      createId,
      hub,
      topic: 't1',
      injectCommand: async (cmd) => {
        injected.push(String(cmd.payload.type));
      },
    });

    await applyRoomEffects(
      [
        ScheduleEffect({
          id: 'flag',
          at: 1_050,
          payload: Tick({}),
        }),
      ],
      [schedule.handler],
      {
        topic: 't1',
        clock,
        now,
        injectCommand: () => undefined,
      }
    );

    expect(kv.alarmAt).toBe(1_050);
    const pending = await loadPendingSchedules(kv, moduleName);
    expect(pending).toHaveLength(1);
    expect(pending[0]?.id).toBe('flag');

    now = 1_050;
    await schedule.fireDue();
    expect(injected).toEqual(['do-sched-test/tick']);
    expect(await loadPendingSchedules(kv, moduleName)).toHaveLength(0);
    expect(kv.alarmAt).toBeNull();
  });
});
