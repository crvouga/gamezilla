// @io-wall-ok — each device owns a process and therefore a Chrome profile.
import { wallTimers } from '@pkgs/clock-shared-ts/wall';
import { createIsolatedProcess } from '@pkgs/os-server-ts/wall-isolated-process';
import type { IsolatedWorker } from '@pkgs/os-server-ts/wall-isolated-worker';
import { browserProcessChannel } from './browser-process-channel';
import type { ScreencastFrame } from './chrome-screencast';
import {
  type BrowserCall,
  type BrowserDocument,
  documentControls,
  remoteBrowserDriver,
} from './remote-browser-driver';

export type BrowserDeviceOptions = {
  readonly initialUrl: string;
  readonly actorId?: string;
  readonly dataStore: { readonly directory: string };
};

function remoteScreencast(rpc: <T>(call: BrowserCall) => Promise<T>) {
  const call = <T>(method: 'start' | 'stop') =>
    rpc<T>({ target: 'screencast', path: [], method, args: [] });
  return {
    start: () => call<void>('start'),
    stop: () => call<readonly ScreencastFrame[]>('stop'),
  };
}

async function openBrowserTab<Open>(
  channel: ReturnType<typeof browserProcessChannel<Open>>,
  open: Open,
  dispose: () => Promise<void>
) {
  const rpc = <T>(call: BrowserCall, timeoutMs?: number) =>
    channel.request<T>({ call }, timeoutMs);
  const raw = remoteBrowserDriver(rpc);
  let closed = false;
  const close = async (): Promise<void> => {
    if (closed) return;
    closed = true;
    try {
      await raw.close();
    } finally {
      await dispose();
    }
  };
  try {
    await channel.request({ open });
  } catch (error) {
    await dispose();
    throw error;
  }
  return {
    driver: { ...raw, close },
    screencast: remoteScreencast(rpc),
    console: channel.consoleLines,
    network: channel.networkLines,
    view: {
      documentControls: (remainingMs: () => number) =>
        documentControls(<T>(call: BrowserCall) => rpc<T>(call, remainingMs())),
      readyDocument: (timeoutMs: number) =>
        rpc<BrowserDocument | null>(
          { target: 'view', path: [], method: 'readyDocument', args: [] },
          timeoutMs
        ),
      loadedUrl: () =>
        rpc<string>({
          target: 'view',
          path: [],
          method: 'loadedUrl',
          args: [],
        }),
      navigate: (url: string) =>
        rpc<void>({
          target: 'view',
          path: [],
          method: 'navigate',
          args: [url],
        }),
      evaluate: <T = unknown>(script: string) =>
        rpc<T>({
          target: 'view',
          path: [],
          method: 'evaluate',
          args: [script],
        }),
      cdp: <T = unknown>(method: string, params?: Record<string, unknown>) =>
        rpc<T>({
          target: 'view',
          path: [],
          method: 'cdp',
          args: [method, params],
        }),
      resize: (width: number, height: number) =>
        rpc<void>({
          target: 'view',
          path: [],
          method: 'resize',
          args: [width, height],
        }),
      screenshot: async (options: { encoding: 'buffer' }) =>
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
    close,
  };
}

/** A short-lived deployed-app device owns its transport and tab together. */
export function connectIsolatedBrowser<Open>(
  open: Open,
  process: IsolatedWorker
) {
  const channel = browserProcessChannel<Open>(process, wallTimers);
  return openBrowserTab(channel, open, channel.close);
}

/** One device process survives app/tab restarts until its storage owner closes it. */
export function createIsolatedBrowserProcess(
  spawn: () => IsolatedWorker = () =>
    createIsolatedProcess(new URL('./native-browser-boot.ts', import.meta.url))
) {
  const channel = browserProcessChannel<BrowserDeviceOptions>(
    spawn(),
    wallTimers
  );
  return {
    open: (options: BrowserDeviceOptions) =>
      openBrowserTab(channel, options, async () => {}),
    close: channel.close,
  };
}
