// @io-wall-ok — real-mode bun-webview: serve the web bundle, then bun:test

process.env['SIM_MODE'] = 'real';
process.env['VITE_API_URL'] =
  process.env['VITE_API_URL'] ?? 'http://127.0.0.1:8787';
process.env['PREVIEW_PORT'] = process.env['PREVIEW_PORT'] ?? '5173';
process.env['SIM_WEB_ORIGIN'] =
  process.env['SIM_WEB_ORIGIN'] ?? 'http://127.0.0.1:5173';
process.env['SIM_WITH_DOM'] = '0';

const origin = process.env['SIM_WEB_ORIGIN'];
const pkgRoot = `${import.meta.dir}/..`;

async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return;
    } catch {
      // not up yet
    }
    await Bun.sleep(200);
  }
  throw new Error(`timed out waiting for ${url}`);
}

const web = Bun.spawn(['bun', './e2e/serve-max-web.ts'], {
  cwd: pkgRoot,
  stdout: 'inherit',
  stderr: 'inherit',
  env: process.env,
});

try {
  await waitForHttp(origin);
  const test = Bun.spawn(
    [
      'bun',
      'test',
      '--preload',
      '@pkgs/bun-test-solid/preload',
      '--preload',
      '@libs/sim-harness/preload',
      '--timeout',
      '120000',
      'tests',
    ],
    {
      cwd: pkgRoot,
      stdout: 'inherit',
      stderr: 'inherit',
      env: process.env,
    }
  );
  const code = await test.exited;
  process.exit(code ?? 1);
} finally {
  web.kill();
}
