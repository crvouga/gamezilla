// @io-wall-ok — e2e host: serves the built harness and drives Bun.WebView.
/**
 * Browser host for the chess board suite: the harness page runs in a real
 * browser engine (`Bun.WebView`, WKWebView on macOS) and the suite drives it
 * through `@pkgs/ui-testing-bun-webview`. Time is wall time.
 */

import { join } from 'node:path';
import { wallTimers } from '@pkgs/clock';
import { BunWebviewDriver } from '@pkgs/ui-testing-bun-webview';

import {
  encodeHarnessConfig,
  type HarnessConfig,
} from '../tests/ui/harness/harness-config';
import type { ChessBoardHost } from '../tests/ui/suite/board-host';

export type WebviewHost = ChessBoardHost & {
  /** Stop the page server and close the browser view. */
  readonly dispose: () => void;
};

function serveStatic(dir: string): ReturnType<typeof Bun.serve> {
  return Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    async fetch(req) {
      const path = new URL(req.url).pathname;
      if (path.includes('..')) return new Response('bad path', { status: 400 });
      const file = Bun.file(join(dir, path === '/' ? 'index.html' : path));
      return (await file.exists())
        ? new Response(file)
        : new Response('not found', { status: 404 });
    },
  });
}

/** Browser engine: WebKit (WKWebView, macOS only) or Chrome over CDP. */
export type WebviewBackend = 'webkit' | 'chrome';

export function createWebviewHost(
  harnessDir: string,
  backend: WebviewBackend
): WebviewHost {
  const server = serveStatic(harnessDir);
  const origin = `http://127.0.0.1:${server.port}`;
  const view = new Bun.WebView({ width: 900, height: 1200, backend });
  let navigation = 0;
  return {
    name: `bun-webview ${backend}`,
    measuresLayout: true,
    async open(config: HarnessConfig) {
      navigation += 1;
      // A fresh query per open forces a full reload (a hash change would not).
      const driver = new BunWebviewDriver({
        view,
        timers: wallTimers,
        baseUrl: `${origin}/?n=${navigation}#${encodeHarnessConfig(config)}`,
      });
      await driver.launch();
      return driver;
    },
    settle: (ms) => Bun.sleep(ms),
    async close() {
      await view.navigate('about:blank');
    },
    dispose() {
      view.close();
      void server.stop(true);
    },
  };
}
