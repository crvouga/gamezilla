/**
 * Actor lookup + virtual-time poll for product scenario actions.
 * `act` receives `S`, not `Run` — waits use the actor Driver (pumped) or
 * `session.advanceTime` between probes.
 */

import { Handles } from '@libs/test-ids';
import { type Action, type ActionDef, defineAction } from '@pkgs/sim';
import type { Driver } from '@pkgs/ui-testing';

import type { ProductSim } from './sim';

const DEFAULT_STEP_MS = 100;
const ACTOR_READY_MAX_MS = 15_000;

export function scenarioAction<const A extends unknown[] = []>(
  def: ActionDef<ProductSim, A>
): Action<ProductSim, A> {
  return defineAction<ProductSim, A>({ ...def, pool: false });
}

export async function ensureActor(
  s: ProductSim,
  actorId: string
): Promise<void> {
  if (s.actors.has(actorId)) return;
  const handle = await s.runtime.launchActor(actorId);
  s.actors.set(actorId, handle);
  await s.session.waitForIdle();
  // Boot gates (SQLite / fonts / assets) can paint before the global menu.
  // Spawn is not complete until chrome is addressable for properties + scenarios.
  await handle.ui.get(Handles.statusCurrentUser).expect.visible({
    timeoutMs: ACTOR_READY_MAX_MS,
  });
}

export async function actorUi(s: ProductSim, actorId: string): Promise<Driver> {
  await ensureActor(s, actorId);
  const handle = s.actors.get(actorId);
  if (handle === undefined) {
    throw new Error(`actor ${actorId} missing`);
  }
  return handle.ui;
}

export type PollUntilOptions = {
  readonly maxMs: number;
  readonly stepMs?: number;
  readonly description: string;
};

export async function pollUntil<T>(
  s: ProductSim,
  probe: () => Promise<T | null>,
  opts: PollUntilOptions
): Promise<T> {
  const stepMs = opts.stepMs ?? DEFAULT_STEP_MS;
  let waited = 0;
  for (;;) {
    const found = await probe();
    if (found !== null) return found;
    if (waited >= opts.maxMs) {
      throw new Error(
        `Timed out after ${String(opts.maxMs)}ms waiting for ${opts.description}`
      );
    }
    await s.session.advanceTime(stepMs);
    await s.session.waitForIdle();
    waited += stepMs;
  }
}
