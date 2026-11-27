/**
 * Actor lookup + virtual-time poll for product scenario actions.
 * `act` receives `S`, not `Run` — waits use the actor Driver (pumped) or
 * `session.advanceTime` between probes.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import type { Action, ActionDef } from '@pkgs/harness-root-shared-ts/effect';
import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { TimeoutError } from '@pkgs/ui-testing-root-shared-ts/timeout-error';

import { describeWhereabouts } from './actor-whereabouts';
import { expectShellShown, shellShown } from './driver-gestures';
import type { HarnessActor, ProductHarness } from './harness';
import { productExtra } from './harness';

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
    (await shellShown(ui)) && !(await ui.get(Handles.bootLoading).isVisible())
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

async function waitForFirstShell(s: ProductHarness, handle: HarnessActor) {
  try {
    await expectShellShown(handle.ui, ACTOR_READY_MAX_MS);
  } catch (cause) {
    if (!(cause instanceof TimeoutError) || !handle.browser) throw cause;
    // This actor has not joined s.actors. Read its launched tab directly,
    // with a short diagnostic deadline in case the document stops answering.
    const place = await describeWhereabouts({
      browser: handle.browser,
      appOrigin: null,
      html: () => handle.ui.snapshotHtml(),
      timers: s.session.ports.timers,
    });
    throw new TimeoutError(
      `${cause.message}; ${handle.id} at ${place}`,
      ACTOR_READY_MAX_MS,
      { cause }
    );
  }
}

export async function ensureActor(
  s: ProductHarness,
  actorId: string,
  initialPath?: string
): Promise<void> {
  if (s.actors.has(actorId)) return;
  const handle = await s.runtime.launchActor(actorId, initialPath);
  await s.session.waitForIdle();
  // Boot gates (SQLite / fonts / assets) can paint before the global menu.
  // Spawn is not complete until chrome is addressable for properties +
  // scenarios, so the actor joins `s.actors` (what properties probe) only
  // after that.
  await waitForFirstShell(s, handle);
  if (productExtra(s).ui.kind === 'bun-webview') {
    // Chrome paints before the initial identity reconciliation. On the
    // landing screen, wait for its ordinary server-backed ready state;
    // otherwise adopting that identity can replace a menu during its tap.
    if ((await handle.currentPath()) === '/')
      await handle.ui.get(Handles.spacesListReady).expect.visible({
        timeoutMs: ACTOR_READY_MAX_MS,
      });
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
  readonly description: string | (() => Promise<string>);
  readonly actor?: string;
};

async function pollTimeout(
  s: ProductHarness,
  opts: PollUntilOptions
): Promise<Error> {
  const description =
    typeof opts.description === 'string'
      ? opts.description
      : await opts.description();
  const prefix = `Timed out after ${String(opts.maxMs)}ms waiting for ${description}`;
  const actor = opts.actor === undefined ? undefined : s.actors.get(opts.actor);
  if (actor === undefined) return new Error(prefix);
  const place = await describeWhereabouts({
    browser: actor.browser,
    appOrigin: null,
    html: () => actor.ui.snapshotHtml(),
  });
  return new Error(`${prefix} at ${place}`);
}

/** A browser probe can pass its remaining budget to each transport request. */
export async function pollUntil<T>(
  s: ProductHarness,
  probe: (remainingMs: () => number) => Promise<T | null>,
  opts: PollUntilOptions
): Promise<T> {
  const stepMs = opts.stepMs ?? DEFAULT_STEP_MS;
  const scheduler = s.session.scheduler;
  const wallStart = scheduler.virtual ? null : scheduler.clock.now();
  let waited = 0;
  let granted = 0;
  const remainingMs = () =>
    Math.max(
      0,
      opts.maxMs -
        (wallStart === null ? waited : scheduler.clock.now() - wallStart)
    );
  for (;;) {
    const found = await probe(remainingMs);
    if (found !== null) return found;
    // A browser probe can spend most of its time driving and reading the
    // page. Count that time against its real deadline as well as the sleeps.
    if (remainingMs() === 0) {
      throw await pollTimeout(s, opts);
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
