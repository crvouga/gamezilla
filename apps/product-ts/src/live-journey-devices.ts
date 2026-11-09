import type { Driver } from '@pkgs/ui-testing-root-shared-ts/driver';
import { openIsolatedDevice } from './isolated-browser';
import type { Device, LiveTarget } from './live-browser';

export type LiveDevices = {
  host: Device | null;
  guest: Device | null;
  shown: Device | null;
  readonly previousPeers: Device[];
};

export function requireDevice(device: Device | null, who: string): Device {
  if (device === null)
    throw new Error(`no ${who}: a journey opens the app first`);
  return device;
}

/** A second person must never clear the first person's Chrome storage. */
export async function openGuestDevice(
  target: LiveTarget,
  devices: LiveDevices,
  link: string,
  open: typeof openIsolatedDevice = openIsolatedDevice
): Promise<void> {
  devices.guest ??= await open(target);
  const guest = requireDevice(devices.guest, 'guest');
  await navigateLiveDevice(
    devices,
    guest,
    new URL(link, target.webOrigin).href
  );
}

const DOCUMENT_MARK = '__liveJourneyDocument';
const DOCUMENT_COMMIT_MS = 30_000;
const DOCUMENT_POLL_MS = 50;

async function documentMark(device: Device): Promise<unknown> {
  try {
    return await device.view.evaluate(`globalThis.${DOCUMENT_MARK}`);
  } catch {
    // A document being replaced cannot answer yet.
    return undefined;
  }
}

/**
 * Activate before starting a document, so startup never runs in a parked
 * tab; return once the new document has replaced the old one, so a later
 * gesture never lands on the old page just before the reload covers it.
 */
export async function navigateLiveDevice(
  devices: LiveDevices,
  device: Device,
  url?: string
): Promise<void> {
  devices.shown = device;
  await device.view.cdp('Page.bringToFront', {});
  const mark = crypto.randomUUID();
  await device.view
    .evaluate(`globalThis.${DOCUMENT_MARK} = ${JSON.stringify(mark)}`)
    .catch(() => undefined);
  if (url === undefined) await device.driver.launch();
  else await device.view.navigate(url);
  const deadline = Date.now() + DOCUMENT_COMMIT_MS;
  while ((await documentMark(device)) === mark) {
    if (Date.now() > deadline)
      throw new Error('the reopened app never replaced the previous page');
    await Bun.sleep(DOCUMENT_POLL_MS);
  }
}

/** Activate the person's tab before reading it or delivering native gestures. */
export async function actOnLiveDevice(
  devices: LiveDevices,
  device: Device,
  gestures: (ui: Driver) => Promise<void>,
  name?: string
): Promise<void> {
  devices.shown = device;
  await device.view.cdp('Page.bringToFront', {});
  try {
    await gestures(device.driver);
  } catch (error) {
    if (name === undefined) throw error;
    throw new Error(`${name}: ${String(error)}`, { cause: error });
  }
}

/**
 * Run the due cleanups on the host's activated page, as a step's gestures
 * run: a cleanup that follows the peer's last gesture would otherwise read a
 * parked page. One cleanup failing does not skip the rest; the first failure
 * is returned for the caller to raise once the devices are closed.
 */
export async function runLiveCleanups(
  devices: LiveDevices,
  cleanups: ReadonlyMap<string, (ui: Driver) => Promise<void>>,
  report: (key: string, error: unknown) => void | Promise<void>
): Promise<unknown> {
  const host = devices.host;
  if (host === null) return null;
  let failure: unknown = null;
  for (const [key, cleanup] of cleanups) {
    try {
      await actOnLiveDevice(devices, host, cleanup);
    } catch (error) {
      await report(key, error);
      failure ??= error;
    }
  }
  return failure;
}
