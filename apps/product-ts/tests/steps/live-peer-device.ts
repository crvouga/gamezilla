import { openIsolatedDevice } from '@apps/product-ts/isolated-browser';
import {
  type Device,
  emulateOffline,
  type LiveTarget,
  readLocation,
} from '@apps/product-ts/live-browser';
import {
  actOnLiveDevice,
  type LiveDevices,
  requireDevice,
} from '@apps/product-ts/live-journey-devices';
import { prepareCriticalJourneyAccess } from '@apps/product-ts/prepare-critical-journey-access';
import {
  atTabShell,
  confirmSignedIn,
} from '@libs/runtime-harness-ts/journey-gestures';
import type {
  JourneyAccess,
  JourneyPeerDevice,
} from '@libs/runtime-harness-ts/journey-types';
import { spaceLinkFromLocation } from '@libs/runtime-harness-ts/journey-types';

export function liveJourneyPeerDevice(
  target: LiveTarget,
  devices: LiveDevices,
  signIn: (
    device: Device,
    continuationToken: string | undefined
  ) => Promise<string>
): JourneyPeerDevice & { open: (access: JourneyAccess) => Promise<void> } {
  let continuationToken: string | undefined;
  const current = () => requireDevice(devices.guest, 'peer');
  const prepare = (device: Device, access: JourneyAccess): Promise<void> =>
    prepareCriticalJourneyAccess({
      access,
      launch: () => device.driver.launch(),
      waitForTabShell: () => atTabShell(device.driver),
      signIn: async () => {
        continuationToken = await signIn(device, continuationToken);
      },
    });
  return {
    open: async (access) => {
      if (devices.guest !== null)
        throw new Error('The second device is already open');
      devices.guest = await openIsolatedDevice(target);
      devices.shown = devices.guest;
      await prepare(devices.guest, access);
    },
    spaceLink: async () =>
      spaceLinkFromLocation(await readLocation(current().view)),
    reopen: () => current().driver.launch(),
    offline: () => emulateOffline(current().view),
    online: async () => {
      await current().view.cdp('Network.emulateNetworkConditions', {
        offline: false,
        latency: 0,
        downloadThroughput: -1,
        uploadThroughput: -1,
      });
    },
    anotherSignedInDevice: async () => {
      if (continuationToken === undefined)
        throw new Error('The second person has not signed in');
      const previous = current();
      await actOnLiveDevice(devices, previous, confirmSignedIn);
      const next = await openIsolatedDevice(target);
      // Keep ownership of a failed sign-in device and the original account's cleanup access.
      const pending = devices.previousPeers.push(next) - 1;
      devices.shown = next;
      await prepare(next, 'signed-in');
      devices.previousPeers[pending] = previous;
      devices.guest = next;
    },
  };
}
