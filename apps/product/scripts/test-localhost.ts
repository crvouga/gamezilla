// @io-wall-ok — localhost profile test entry: build web, serve it, run the DSL.
import { createServer } from 'node:net';
import { startLocalhostServices } from './localhost-services-process';

const selection = process.argv[2];
if (selection !== 'mocked' && selection !== 'localhost') {
  throw new Error('usage: test-localhost.ts mocked|localhost [test files...]');
}
const mocked = selection === 'mocked';
process.env['SIM_PROFILE'] = mocked ? 'localhost:mocked' : 'localhost';
process.env['SIM_WITH_DOM'] = '0';
process.env['VITE_E2E'] = '1';

async function dynamicPort(): Promise<number> {
  const server = createServer();
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error('dynamic port allocation failed');
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
  return address.port;
}

const apiPort = mocked ? await dynamicPort() : 8787;
const webPort = mocked ? await dynamicPort() : 5173;
process.env['SIM_HTTP_PORT'] = String(apiPort);
process.env['SIM_API_ORIGIN'] = `http://localhost:${String(apiPort)}`;
process.env['PREVIEW_PORT'] = String(webPort);
process.env['SIM_WEB_ORIGIN'] = `http://localhost:${String(webPort)}`;
process.env['VITE_API_URL'] = process.env['SIM_WEB_ORIGIN'];
process.env['LOCAL_PREVIEW_API_ORIGIN'] = process.env['SIM_API_ORIGIN'];

const origin = process.env['SIM_WEB_ORIGIN'];
const pkgRoot = `${import.meta.dir}/..`;
const args = process.argv.slice(3);
const testFiles =
  args.length > 0 ? args : mocked ? ['tests'] : ['tests/shell-boot.test.tsx'];

try {
  await fetch(origin, { signal: AbortSignal.timeout(1_000) });
  throw new Error(`web origin already in use: ${origin}`);
} catch (error) {
  if (error instanceof Error && error.message.startsWith('web origin')) {
    throw error;
  }
}

async function waitForHttp(url: string, timeoutMs = 60_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await Bun.sleep(200);
  }
  throw new Error(`timed out waiting for ${url}`);
}

const build = Bun.spawn(['bun', 'run', '--filter', '@apps/client', 'build'], {
  cwd: `${pkgRoot}/../..`,
  stdout: 'inherit',
  stderr: 'inherit',
  env: process.env,
});
if ((await build.exited) !== 0) process.exit(1);

const web = Bun.spawn(['bun', './e2e/serve-localhost-web.ts'], {
  cwd: pkgRoot,
  stdout: 'inherit',
  stderr: 'inherit',
  env: process.env,
});

let exitCode = 1;
let stack: Awaited<ReturnType<typeof startLocalhostServices>> | null = null;
try {
  await Promise.race([
    waitForHttp(origin),
    web.exited.then((code) => {
      throw new Error(`web preview exited before ready (${String(code)})`);
    }),
  ]);
  if (!mocked) {
    stack = await startLocalhostServices();
    process.env['SIM_STACK_EXTERNAL'] = '1';
    process.env['SIM_OBJECT_STORE_ORIGIN'] = stack.origin;
  }
  const test = Bun.spawn(
    [
      'bun',
      'test',
      '--conditions=browser',
      '--conditions=development',
      '--preload',
      './bun-babel-plugin.ts',
      '--preload',
      './bun-preload.ts',
      '--timeout',
      '120000',
      ...testFiles,
    ],
    {
      cwd: pkgRoot,
      stdout: 'inherit',
      stderr: 'inherit',
      env: {
        ...process.env,
        NODE_OPTIONS:
          process.env['NODE_OPTIONS'] ?? '--max-old-space-size=8192',
      },
    }
  );
  exitCode = (await test.exited) ?? 1;
} finally {
  web.kill();
  await web.exited;
  await stack?.stop();
}
process.exit(exitCode);
