/**
 * Chess board UI suite in a real browser engine (`Bun.WebView`). Same
 * scenarios as `tests/chess-board-ui.test.ts`, which runs them in happy-dom.
 */

import { afterAll, beforeAll } from 'bun:test';

import { defineChessBoardSuite } from '../../tests/ui/suite/define-chess-board-suite';
import { buildHarness } from '../build-harness';
import {
  createWebviewHost,
  type WebviewBackend,
  type WebviewHost,
} from '../webview-host';

/** `CHESS_BOARD_WEBVIEW=chrome` runs the suite on Chrome instead of WebKit. */
const BACKEND: WebviewBackend =
  process.env['CHESS_BOARD_WEBVIEW'] === 'chrome' ? 'chrome' : 'webkit';

let host: WebviewHost | undefined;

function requireHost(): WebviewHost {
  if (host === undefined) throw new Error('webview host not started');
  return host;
}

beforeAll(async () => {
  host = createWebviewHost(await buildHarness(), BACKEND);
}, 120_000);

afterAll(() => {
  host?.dispose();
});

defineChessBoardSuite({
  name: `bun-webview ${BACKEND}`,
  measuresLayout: true,
  open: (config) => requireHost().open(config),
  settle: (ms) => requireHost().settle(ms),
  close: () => requireHost().close(),
});
