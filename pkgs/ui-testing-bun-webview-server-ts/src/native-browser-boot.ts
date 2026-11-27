// @io-wall-ok — one actor's native browser and durable profile, owned by its parent.
import { wallClock, wallTimers } from '@pkgs/clock-shared-ts/wall';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview-shared-ts/bun-webview-driver';
import { browserCallDiagnostics } from './browser-call-diagnostics';
import { serveBrowserProcess } from './browser-process-server';
import { chromeDocumentVisibility } from './chrome-document-visibility';
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
  const diagnostics = browserCallDiagnostics(wallClock, wallTimers);
  const driver = new BunWebviewDriver({
    view: diagnostics.view(view, 'opener'),
    ...(backend !== 'webkit' && {
      readDocumentVisibility: chromeDocumentVisibility(view, diagnostics),
    }),
    baseUrl: options.initialUrl,
    ...(options.actorId === undefined ? {} : { actorId: options.actorId }),
    popupOptions: {
      backend,
      dataStore: options.dataStore,
      createView: (init) => diagnostics.view(new Bun.WebView(init), 'popup'),
    },
    timers: wallTimers,
  });
  return {
    view,
    driver,
    traceCall: diagnostics.traceCall,
    close: () => driver.close(),
  };
});
