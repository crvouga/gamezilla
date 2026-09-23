/**
 * Actor lookup + virtual-time poll for product scenario actions.
 * `act` receives `S`, not `Run` — waits use the actor Driver (pumped) or
 * `session.advanceTime` between probes.
 */

import { Handles } from '@libs/test-ids';
import { type Action, type ActionDef, defineAction } from '@pkgs/sim';
import type { Driver } from '@pkgs/ui-testing';

import { type ProductSim, productExtra } from './sim';

const DEFAULT_STEP_MS = 100;
const ACTOR_READY_MAX_MS = 15_000;

/**
 * Scenario pin. Default `pool: false` (scripted `s.apply` only). Pass
 * `pool: true` with `enabled` / `sample` to also join explore / randomActions.
 */
export function scenarioAction<const A extends unknown[] = []>(
  def: ActionDef<ProductSim, A>
): Action<ProductSim, A> {
  return defineAction<ProductSim, A>({
    ...def,
    pool: def.pool === true,
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
  s: ProductSim,
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
  s: ProductSim,
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

export async function actorUi(s: ProductSim, actorId: string): Promise<Driver> {
  await ensureActor(s, actorId);
  const handle = s.actors.get(actorId);
  if (handle === undefined) {
    throw new Error(`actor ${actorId} missing`);
  }
  return handle.ui;
}

const BACK_PRESS_LIMIT = 3;
const BACK_SETTLE_MS = 2_000;

/**
 * Press the chrome back arrow until `target` shows. On wall time a press can
 * land while the previous screen's chrome is still swapping out and be lost —
 * a user presses again. Virtual time settles first, so one press lands.
 */
export async function pressBackUntilVisible(
  ui: Driver,
  target: string,
  timeoutMs: number
): Promise<void> {
  const goal = ui.get(target);
  for (let press = 0; press < BACK_PRESS_LIMIT; press += 1) {
    if (await goal.isVisible()) return;
    await ui.get(Handles.navBack).tap({ timeoutMs });
    try {
      await goal.expect.visible({ timeoutMs: BACK_SETTLE_MS });
      return;
    } catch {
      // The press landed mid-transition; press again.
    }
  }
  await goal.expect.visible({ timeoutMs });
}

const MENU_OPEN_LIMIT = 3;
const MENU_SETTLE_MS = 2_000;

/**
 * Open the avatar (global) menu until `item` shows. On wall time a data
 * refresh can re-render the trigger and close the menu right after it opens —
 * a user taps again. Virtual time settles first, so one tap opens it.
 */
export async function openGlobalMenu(
  ui: Driver,
  item: string,
  timeoutMs: number
): Promise<void> {
  const goal = ui.get(item);
  for (let tap = 0; tap < MENU_OPEN_LIMIT; tap += 1) {
    if (await goal.isVisible()) return;
    await ui.get(Handles.statusCurrentUser).tap({ timeoutMs });
    try {
      await goal.expect.visible({ timeoutMs: MENU_SETTLE_MS });
      return;
    } catch {
      // The menu closed under a re-render; open it again.
    }
  }
  await goal.expect.visible({ timeoutMs });
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
