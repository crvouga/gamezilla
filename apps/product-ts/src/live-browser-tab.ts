// @io-wall-ok — the device's browser process owns this ephemeral tab and its popups.
import { wallTimers } from '@pkgs/clock-shared-ts/wall';
import { chromeScreencast } from '@pkgs/ui-testing-bun-webview-server-ts/chrome-screencast';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';
import { browserNetworkEvidence } from './browser-network-evidence';
import type { LiveTarget } from './live-browser';

/** Health and ordinary journeys use the phone. A capture can request the desktop shell. */
const VIEWPORT = process.env['JOURNEY_CAPTURE_VIEWPORT'] === 'desktop'
  ? { width: 1280, height: 800 }
  : { width: 390, height: 844 };
const CHROME_BACKEND = { type: 'chrome', url: false } as const;

function formatConsoleArg(arg: unknown): string {
  if (typeof arg === 'string') return arg;
  try {
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

/** Opens the first tab in this device’s owned Chrome process. */
export async function openBrowserTab(
  target: Pick<LiveTarget, 'webOrigin' | 'apiOrigin'>,
  createView: (options: Bun.WebView.ConstructorOptions) => Bun.WebView = (
    options
  ) => new Bun.WebView(options)
) {
  const dataStore = 'ephemeral' as const;
  const consoleLines: string[] = [];
  const view = createView({
    ...VIEWPORT,
    backend: CHROME_BACKEND,
    dataStore,
    console: (type, ...args) => {
      consoleLines.push(`[${type}] ${args.map(formatConsoleArg).join(' ')}`);
    },
  });
  await view.navigate('about:blank');
  // Chrome associates socket throttling with the session when a socket opens.
  // Enable it before the app creates rooms, not only when going offline.
  await view.cdp('Network.enable');
  const network = browserNetworkEvidence(view);
  const driver = new BunWebviewDriver({
    view,
    baseUrl: target.webOrigin,
    popupOptions: { dataStore, backend: CHROME_BACKEND },
    timers: wallTimers,
  });
  return {
    apiOrigin: target.apiOrigin,
    screencast: chromeScreencast(view),
    view,
    driver,
    console: consoleLines,
    network,
    close: () => driver.close(),
  };
}
