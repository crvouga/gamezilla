// @io-wall-ok — live health composition: an owned independent browser process.
import { createIsolatedProcess } from '@pkgs/os-server/wall-isolated-process';
import type { IsolatedWorker } from '@pkgs/os-server/wall-isolated-worker';
import { browserProcessChannel } from './browser-process-channel';
import type { Device, LiveTarget } from './live-browser';
import { type BrowserCall, remoteBrowserDriver } from './remote-browser-driver';
export async function openIsolatedDevice(
  target: Pick<LiveTarget, 'webOrigin' | 'apiOrigin'>,
  spawn: () => IsolatedWorker = () =>
    createIsolatedProcess(
      new URL('./isolated-browser-entry.ts', import.meta.url)
    )
): Promise<Device> {
  const process = spawn();
  const channel = browserProcessChannel(process);
  const rpc = <T>(call: BrowserCall) => channel.request<T>({ call });
  const driver = remoteBrowserDriver(rpc);
  try {
    await channel.request({ open: target });
  } catch (error) {
    channel.close();
    throw error;
  }
  return {
    apiOrigin: target.apiOrigin,
    driver,
    console: channel.consoleLines,
    network: channel.networkLines,
    view: {
      navigate: (url) =>
        rpc({ target: 'view', path: [], method: 'navigate', args: [url] }),
      evaluate: (script) =>
        rpc({ target: 'view', path: [], method: 'evaluate', args: [script] }),
      cdp: (method, params) =>
        rpc({
          target: 'view',
          path: [],
          method: 'cdp',
          args: [method, params],
        }),
      screenshot: async (options) =>
        Buffer.from(
          await rpc<string>({
            target: 'view',
            path: [],
            method: 'screenshot',
            args: [options],
          }),
          'base64'
        ),
    },
    close: async () => {
      try {
        await driver.close();
      } finally {
        channel.close();
      }
    },
  };
}
