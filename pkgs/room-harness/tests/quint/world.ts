/**
 * The world a room model's traces run in: the room harness the binding's `init`
 * opens on the example game room, disposed after the last step.
 *
 * A model whose state does not depend on time (`patient`) is given up to
 * 15 s of virtual time to reach the model's state after each step, so
 * pushes that land a few ticks later count. A clock model is compared right
 * after each step instead — letting time run would move its clock.
 */

import type { Run } from '@pkgs/harness-shared/run-types';
import type { TraceContext } from '@pkgs/quint-shared/registry';
import { setQuintWorld } from '@pkgs/quint-shared/registry';
import type { RoomHarness } from '@pkgs/room-harness/harness';
import { clientHash, serverHash } from '@pkgs/room-harness/observations';

export type RoomTraceWorld = {
  readonly ctx: TraceContext;
  harness: Run<RoomHarness> | null;
  patient: boolean;
};

const SETTLE_MS = 15_000;
const SETTLE_STEP_MS = 25;

export function traceRoom(w: RoomTraceWorld): Run<RoomHarness> {
  if (w.harness === null)
    throw new Error('no room — the binding init opens one');
  return w.harness;
}

/** The room's and every running device's state hash: a replay's end state. */
export async function roomFingerprint(w: RoomTraceWorld): Promise<string> {
  const s = traceRoom(w);
  return JSON.stringify({
    room: await s.read(serverHash),
    devices: await s.read(clientHash),
  });
}

export function useRoomTraceWorld(): void {
  setQuintWorld<RoomTraceWorld>({
    create: async (ctx) => ({ ctx, harness: null, patient: false }),
    dispose: async (w) => {
      await w.harness?.[Symbol.asyncDispose]();
    },
    settle: async (w, matches) => {
      if (!w.patient || w.harness === null) return;
      try {
        await w.harness.until(() => matches(), {
          maxMs: SETTLE_MS,
          stepMs: SETTLE_STEP_MS,
        });
      } catch {
        // Still apart: the bridge reads the state once more and reports the
        // variables that differ.
      }
    },
  });
}
