// @io-wall-ok — live health composition: an owned independent browser process.
import { createIsolatedProcess } from '@pkgs/os-server-ts/wall-isolated-process';
import type { IsolatedWorker } from '@pkgs/os-server-ts/wall-isolated-worker';
import { connectIsolatedBrowser } from '@pkgs/ui-testing-bun-webview-server-ts/wall-io';
import type { Device, LiveTarget } from './live-browser';

export async function openIsolatedDevice(
  target: Pick<LiveTarget, 'webOrigin' | 'apiOrigin'>,
  spawn: () => IsolatedWorker = () =>
    createIsolatedProcess(
      new URL('./isolated-browser-entry.ts', import.meta.url)
    )
): Promise<Device> {
  const browser = await connectIsolatedBrowser(target, spawn());
  return { ...browser, apiOrigin: target.apiOrigin };
}
