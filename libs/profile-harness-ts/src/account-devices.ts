/**
 * The account's devices, as a person reaches and reads them: Settings →
 * Account → Devices, the "N devices" count over the list, and the
 * "This device" mark on the row of the device in hand.
 */

import { DEVICE_ID_KEY } from '@libs/auth-shared-ts/auth-storage-keys';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { openAccountScreen } from '@libs/harness-ts/sign-in-method-actions';
import { Handles } from '@libs/test-ids-shared-ts/handles';

type ActorUi = Awaited<ReturnType<typeof actorUi>>;

const TAP_WAIT_MS = 15_000;

/**
 * Bring the actor's phone to the front without asserting anything on it:
 * waits focus the actor, and nothing carries this id, so it returns at once.
 */
async function focus(ui: ActorUi): Promise<void> {
  await ui.get('harness-focus-probe').expect.hidden({ timeoutMs: 1 });
}

/** Settings → Account → Devices, from wherever the actor is. */
export const openDevices = scenarioAction({
  name: 'openDevices',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await openAccountScreen(s, ui);
    await ui.get(Handles.accountDevices).tap({ timeoutMs: TAP_WAIT_MS });
  },
});

/** How many devices the open devices list counts, or `null` when none shows. */
export async function devicesShown(
  s: ProductHarness,
  actorId: string
): Promise<number | null> {
  try {
    const ui = await actorUi(s, actorId);
    await focus(ui);
    const text = await ui.get(Handles.accountDevicesCount).text();
    const count = Number.parseInt(text ?? '', 10);
    return Number.isNaN(count) ? null : count;
  } catch {
    return null;
  }
}

/** The open devices list marks the row of the device the actor holds. */
export async function currentDeviceMarked(
  s: ProductHarness,
  actorId: string
): Promise<boolean> {
  try {
    const env = await s.harness.client(actorId);
    const deviceId = env.secureStorage.getValue(DEVICE_ID_KEY);
    if (typeof deviceId !== 'string' || deviceId.length === 0) return false;
    const ui = await actorUi(s, actorId);
    await focus(ui);
    return await ui
      .get(Handles.accountDevice(deviceId))
      .get(Handles.accountDeviceCurrent)
      .isVisible();
  } catch {
    return false;
  }
}
