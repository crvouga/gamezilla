/**
 * The world a room model's traces run in: the room sim the binding's `init`
 * opens (each model picks its room app), disposed after the last step.
 *
 * A model whose state does not depend on time (`patient`) is given up to
 * 15 s of virtual time to reach the model's state after each step, so
 * pushes that land a few ticks later count. A clock model is compared right
 * after each step instead — letting time run would move its clock.
 */

import { setQuintWorld, type TraceContext } from '@pkgs/quint/registry';
import { clientHash, type RoomSim, serverHash } from '@pkgs/room-sim';
import type { Run } from '@pkgs/sim';

export type RoomTraceWorld = {
  readonly ctx: TraceContext;
  sim: Run<RoomSim> | null;
  patient: boolean;
};

const SETTLE_MS = 15_000;
const SETTLE_STEP_MS = 25;

export function traceRoom(w: RoomTraceWorld): Run<RoomSim> {
  if (w.sim === null) throw new Error('no room — the binding init opens one');
  return w.sim;
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
    create: async (ctx) => ({ ctx, sim: null, patient: false }),
    dispose: async (w) => {
      await w.sim?.[Symbol.asyncDispose]();
    },
    settle: async (w, matches) => {
      if (!w.patient || w.sim === null) return;
      try {
        await w.sim.until(() => matches(), {
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
