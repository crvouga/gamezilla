/**
 * Actor lookup + virtual-time poll for product scenario actions.
 * `act` receives `S`, not `Run` — waits use the actor Driver (pumped) or
 * `session.advanceTime` between probes.
 */

import { Handles } from '@libs/test-ids';
import { type Action, type ActionDef, defineAction } from '@pkgs/harness';
import type { Driver } from '@pkgs/ui-testing';

import { type ProductHarness, productExtra } from './harness';

const DEFAULT_STEP_MS = 100;
const ACTOR_READY_MAX_MS = 15_000;

/** Scenario action: applied by name from a script (`s.apply`), never drawn at random. */
export function scenarioAction<const A extends unknown[] = []>(
  def: ActionDef<ProductHarness, A>
): Action<ProductHarness, A> {
  return defineAction<ProductHarness, A>({
    ...def,
    pool: false,
  });
}

/**
 * Consecutive settled probes a wall-clock browser actor needs before spawn
 * completes. A fresh install paints chrome, then adopts the server identity
 * (boot canvas) before the final paint; virtual time drains that inside the
 * pump, a real browser shows it for real.
 */
const WALL_SETTLED_PROBES = 5;

async function chromeSettled(ui: Driver): Promise<boolean> {
  return (
    (await ui.get(Handles.statusCurrentUser).isVisible()) &&
    !(await ui.get(Handles.bootLoading).isVisible())
  );
}

async function waitForWallChromeSettled(
  s: ProductHarness,
  ui: Driver
): Promise<void> {
  let settled = 0;
  await pollUntil(
    s,
    async () => {
      settled = (await chromeSettled(ui)) ? settled + 1 : 0;
      return settled >= WALL_SETTLED_PROBES ? true : null;
    },
    { maxMs: ACTOR_READY_MAX_MS, description: 'actor chrome to settle' }
  );
}

export async function ensureActor(
  s: ProductHarness,
  actorId: string
): Promise<void> {
  if (s.actors.has(actorId)) return;
  const handle = await s.runtime.launchActor(actorId);
  await s.session.waitForIdle();
  // Boot gates (SQLite / fonts / assets) can paint before the global menu.
  // Spawn is not complete until chrome is addressable for properties +
  // scenarios, so the actor joins `s.actors` (what properties probe) only
  // after that.
  await handle.ui.get(Handles.statusCurrentUser).expect.visible({
    timeoutMs: ACTOR_READY_MAX_MS,
  });
  if (productExtra(s).ui.kind === 'bun-webview') {
    await waitForWallChromeSettled(s, handle.ui);
  }
  s.actors.set(actorId, handle);
}

export async function actorUi(
  s: ProductHarness,
  actorId: string
): Promise<Driver> {
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
  s: ProductHarness,
  probe: () => Promise<T | null>,
  opts: PollUntilOptions
): Promise<T> {
  const stepMs = opts.stepMs ?? DEFAULT_STEP_MS;
  let waited = 0;
  let granted = 0;
  for (;;) {
    const found = await probe();
    if (found !== null) return found;
    if (waited >= opts.maxMs) {
      throw new Error(
        `Timed out after ${String(opts.maxMs)}ms waiting for ${opts.description}`
      );
    }
    // A poll the scheduler spent running ahead of unfinished wall work moved
    // the clock without moving the simulation, so it does not spend the
    // budget. Capped, so a genuinely stuck wait still ends.
    const starvedBefore = s.session.scheduler.starvedAdvances();
    await s.session.advanceTime(stepMs);
    await s.session.waitForIdle();
    if (
      s.session.scheduler.starvedAdvances() > starvedBefore &&
      granted < opts.maxMs
    ) {
      granted += stepMs;
      continue;
    }
    waited += stepMs;
  }
}
