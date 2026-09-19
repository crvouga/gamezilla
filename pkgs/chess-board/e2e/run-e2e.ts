// @io-wall-ok — run the chess board suite in a real browser engine.
// macOS runs the harness page in WKWebView through Bun.WebView; Linux (CI)
// runs it in headless Chrome over CDP. Only a local machine with no browser
// at all falls back to the in-process happy-dom suite, as `bun run test` does.

import { resolveE2eBrowser } from '@pkgs/ui-testing-bun-webview/e2e-browser';

const HERE = import.meta.dir;

const browser = resolveE2eBrowser();

const command =
  browser.engine === null
    ? [
        'bun',
        'test',
        '--conditions=browser',
        '--conditions=development',
        '--preload',
        '@pkgs/bun-test-solid/preload',
        './tests/chess-board-ui.test.ts',
      ]
    : ['bun', 'test', '--timeout', '120000', './e2e/tests'];

if (browser.engine === null) {
  console.log(
    `chess-board e2e: ${browser.reason}; running the in-process suite.`
  );
}

const test = Bun.spawn(command, {
  cwd: `${HERE}/..`,
  env: {
    ...process.env,
    // WebKit exists only on macOS; elsewhere the suite must pick Chrome.
    ...(browser.engine === 'chrome' ? { CHESS_BOARD_WEBVIEW: 'chrome' } : {}),
  },
  stdout: 'inherit',
  stderr: 'inherit',
});
process.exit((await test.exited) ?? 1);
