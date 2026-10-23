import { originAvailabilityFor } from '@libs/app-root-client-ts/origin-availability-for-env';
import { defineAction } from '@pkgs/harness-root-shared-ts/define-action';
import type { UiOp } from '@pkgs/ui-testing-root-shared-ts/ui-op';
import {
  describeUiOp,
  performUiOp,
} from '@pkgs/ui-testing-root-shared-ts/ui-op';
import { ensureActor, pollUntil } from './actor-ui';
import type { ProductHarness } from './harness';
import { productExtra } from './harness';
import { deviceMemberIdOf } from './identity';
import { caps, partitioned } from './observations';
import { chooseOfflineCommand } from './offline-gestures';
import { HARNESS_PRIMARY_SERVER_ID } from './server-nodes';

export const spawnActor = defineAction({
  name: 'spawnActor',
  act: async (s: ProductHarness, id: string) => {
    if (id === '') return;
    await ensureActor(s, id);
  },
});

export const resetActor = defineAction({
  name: 'resetActor',
  pool: false,
  act: async (s: ProductHarness, id: string) => {
    await s.runtime.resetActor(id);
  },
});

/** App killed and reopened (same device, same storage). */
export const restartApp = defineAction({
  name: 'restartApp',
  pool: false,
  act: async (s: ProductHarness, id: string) => {
    await s.runtime.restartActor(id);
    await ensureActor(s, id);
  },
});

/** What the app kept on this device stops being usable (damaged, full, locked). */
export const damageDeviceData = defineAction({
  name: 'damageDeviceData',
  pool: false,
  act: async (s: ProductHarness, id: string) => {
    await s.runtime.damageDeviceData(id);
  },
});

export const partition = defineAction({
  name: 'partition',
  // Connectivity can change while every app is closed, before a later reopen.
  enabled: (s: ProductHarness) =>
    caps(s).includes('partition') || productExtra(s).ui.kind === 'bun-webview',
  act: async (s: ProductHarness, id: string) => {
    if (id === '') return;
    // regression: browser-room-connection-control
    if (!caps(s).includes('partition')) {
      await chooseOfflineCommand(s, id.replace(/:events$/, ''), true);
      return;
    }
    s.session.network.partition(HARNESS_PRIMARY_SERVER_ID, id);
    s.harness.partition(HARNESS_PRIMARY_SERVER_ID, id);
  },
});

export const restoreNetwork = defineAction({
  name: 'restoreNetwork',
  enabled: (s: ProductHarness) =>
    (caps(s).includes('partition') && partitioned(s).length > 0) ||
    productExtra(s).ui.kind === 'bun-webview',
  act: async (s: ProductHarness) => {
    if (!caps(s).includes('partition')) {
      for (const id of s.actors.keys())
        await chooseOfflineCommand(s, id, false);
      return;
    }
    s.session.network.healAll();
    s.harness.heal();
    for (const id of s.actors.keys()) await refreshOrigin(s, id);
  },
});

/** Restore one person's connection while others may remain away. */
export const restoreActorConnection = defineAction({
  name: 'restoreActorConnection',
  enabled: (s: ProductHarness) =>
    (caps(s).includes('partition') && partitioned(s).length > 0) ||
    productExtra(s).ui.kind === 'bun-webview',
  act: async (s: ProductHarness, id: string) => {
    if (!caps(s).includes('partition')) {
      await chooseOfflineCommand(s, id.replace(/:events$/, ''), false);
      return;
    }
    s.session.network.heal(HARNESS_PRIMARY_SERVER_ID, id);
    s.harness.heal(HARNESS_PRIMARY_SERVER_ID, id);
    await refreshOrigin(s, id);
  },
});

/** Observe the current origin through the app's health probe. */
export const refreshActorConnection = defineAction({
  name: 'refreshActorConnection',
  pool: false,
  act: refreshOrigin,
});

/** Let query-backed commands observe a changed connection before the next action. */
export const refreshActorQueries = defineAction({
  name: 'refreshActorQueries',
  pool: false,
  act: async (s: ProductHarness, id: string) => {
    if (!s.actors.has(id)) return;
    const client = await s.harness.spawnClient(id);
    const identity = await deviceMemberIdOf(s, id);
    if (identity === null) return;
    const engine = client.syncEnginePool.peekReady(
      client.env.resolveDatabaseName({ userId: identity })
    );
    if (engine === null) return;
    let drained = false;
    void engine.refreshQueries().then(() => {
      drained = true;
    });
    await pollUntil(s, () => Promise.resolve(drained ? true : null), {
      maxMs: 5000,
      stepMs: 1,
      description: 'the changed connection at query transport',
    });
  },
});

/** A returning connection wakes the health probe, including after offline boot. */
async function refreshOrigin(s: ProductHarness, id: string): Promise<void> {
  if (!s.actors.has(id)) return;
  const env = await s.harness.client(id);
  await originAvailabilityFor(env).refresh();
}

/** How far one jump of {@link letTimePass} moves the world. */
const TIME_PASS_HOP_MS = 60 * 60 * 1000;
/** After each jump: long enough for the requests it set off to answer. */
const TIME_PASS_SETTLE_MS = 2_000;

/**
 * Days go by for everyone — devices, servers, the payment provider — in
 * hour-long jumps, as a sleeping machine sees them: each jump fires whatever
 * fell due once, then lets the answers land. Stepping every heartbeat through
 * a week of virtual time would take minutes; this takes a few seconds and
 * still wakes each device every hour. Needs virtual time.
 */
export const letTimePass = defineAction({
  name: 'letTimePass',
  pool: false,
  enabled: (s: ProductHarness) => s.session.caps.has('virtualTime'),
  act: async (s: ProductHarness, ms: number) => {
    const end = s.session.ports.clock.now() + ms;
    for (;;) {
      await s.session.waitForIdle();
      const left = end - s.session.ports.clock.now();
      if (left <= TIME_PASS_SETTLE_MS) break;
      const hop = Math.min(TIME_PASS_HOP_MS, left - TIME_PASS_SETTLE_MS);
      await s.session.scheduler.underlying.sleep(hop);
      await s.session.advanceTime(TIME_PASS_SETTLE_MS);
    }
    const left = end - s.session.ports.clock.now();
    if (left > 0) await s.session.advanceTime(left);
  },
});

/** Replay / report of a concrete UI op. */
export const uiOp = defineAction({
  name: 'uiOp',
  pool: false,
  describe: (op: UiOp) => describeUiOp(op),
  act: async (s: ProductHarness, op: UiOp) => {
    const handle = s.actors.get(op.actorId);
    if (handle === undefined) return;
    await performUiOp(handle.ui, op);
  },
});
