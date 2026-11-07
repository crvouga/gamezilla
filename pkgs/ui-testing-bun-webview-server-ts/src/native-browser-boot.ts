// @io-wall-ok — one actor's native browser and durable profile, owned by its parent.
import { wallTimers } from '@pkgs/clock-shared-ts/wall';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';
import { serveBrowserProcess } from './browser-process-server';
import type { BrowserDeviceOptions } from './wall-io';

serveBrowserProcess(async (options: BrowserDeviceOptions) => {
  // Match the native harness matrix: WebKit on macOS, Chrome elsewhere.
  const backend: Bun.WebView.Backend =
    process.platform === 'darwin' ? 'webkit' : { type: 'chrome', url: false };
  const view = new Bun.WebView({
    width: 390,
    height: 844,
    backend,
    dataStore: options.dataStore,
  });
  const driver = new BunWebviewDriver({
    view,
    baseUrl: options.webOrigin,
    ...(options.actorId === undefined ? {} : { actorId: options.actorId }),
    popupOptions: { backend, dataStore: options.dataStore },
    timers: wallTimers,
  });
  return { view, driver, close: () => driver.close() };
});
