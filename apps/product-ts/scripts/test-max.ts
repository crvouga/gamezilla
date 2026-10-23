// @io-wall-ok — real-mode bun-webview: serve the web bundle, then every spec suite
import { runSpecSuites } from './spec-suites';

process.env['HARNESS_MODE'] = 'real';
process.env['VITE_API_URL'] =
  process.env['VITE_API_URL'] ?? 'http://127.0.0.1:8787';
process.env['PREVIEW_PORT'] = process.env['PREVIEW_PORT'] ?? '5173';
process.env['HARNESS_WEB_ORIGIN'] =
  process.env['HARNESS_WEB_ORIGIN'] ?? 'http://127.0.0.1:5173';
process.env['HARNESS_WITH_DOM'] = '0';

const origin = process.env['HARNESS_WEB_ORIGIN'];
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

const web = Bun.spawn(['bun', './scripts/serve-max-web.ts'], {
  cwd: pkgRoot,
  stdout: 'inherit',
  stderr: 'inherit',
  env: process.env,
});

let code = 1;
try {
  await waitForHttp(origin);
  code = await runSpecSuites(
    {
      ...process.env,
      HARNESS_PRELOAD: `${pkgRoot}/src/real-stack-preload.ts`,
    },
    process.argv.slice(2)
  );
} finally {
  web.kill();
}
process.exit(code);
