// @io-wall-ok — run the chess board suite in a real browser engine.
// On macOS the harness page runs in WKWebView through Bun.WebView. Elsewhere
// (no WebView engine on the runner) the same suite runs in-process in
// happy-dom, as `bun run test` does.

const HERE = import.meta.dir;

const command =
  process.platform === 'darwin'
    ? ['bun', 'test', '--timeout', '120000', './e2e/tests']
    : [
        'bun',
        'test',
        '--conditions=browser',
        '--conditions=development',
        '--preload',
        '@pkgs/bun-test-solid/preload',
        './tests/chess-board-ui.test.ts',
      ];

if (process.platform !== 'darwin') {
  console.log(
    'chess-board e2e: Bun.WebView needs macOS here; running the in-process suite.'
  );
}

const test = Bun.spawn(command, {
  cwd: `${HERE}/..`,
  stdout: 'inherit',
  stderr: 'inherit',
});
process.exit((await test.exited) ?? 1);
