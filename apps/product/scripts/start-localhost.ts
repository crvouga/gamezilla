// @io-wall-ok — process entry for the mocked localhost app.
import { createServer } from 'node:net';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { wallClock, wallTimers } from '@pkgs/clock';
import type { ProductSim } from '../src/sim';

const preserved = new Map<string, PropertyDescriptor>();
for (const key of [
  'fetch',
  'Request',
  'Response',
  'Headers',
  'crypto',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
]) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, key);
  if (descriptor !== undefined) preserved.set(key, descriptor);
}
GlobalRegistrator.register({ url: 'http://localhost/' });
for (const [key, descriptor] of preserved) {
  Object.defineProperty(globalThis, key, descriptor);
}
const { product, productExtra, listenSimHttpServer } = await import(
  '../src/sim'
);
const { defineAction } = await import('@pkgs/sim');

const profile = 'localhost:mocked';

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

async function run(args: string[], cwd: string): Promise<void> {
  const child = Bun.spawn(args, {
    cwd,
    env: { ...process.env, NODE_ENV: 'production' },
    stdout: 'inherit',
    stderr: 'inherit',
  });
  const code = await child.exited;
  if (code !== 0) throw new Error(`${args.join(' ')} exited ${String(code)}`);
}

async function waitForReady(
  url: string,
  child: ReturnType<typeof Bun.spawn>
): Promise<void> {
  const deadline = wallClock.now() + 60_000;
  while (wallClock.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`web preview exited ${String(child.exitCode)}`);
    }
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // Listener is still starting.
    }
    await new Promise<void>((resolve) => wallTimers.setTimeout(resolve, 200));
  }
  throw new Error(`timed out waiting for ${url}`);
}

const root = `${import.meta.dir}/../../..`;
const apiPort = await dynamicPort();
const webPort = await dynamicPort();
process.env['SIM_HTTP_PORT'] = String(apiPort);
process.env['SIM_API_ORIGIN'] = `http://localhost:${String(apiPort)}`;
process.env['PREVIEW_PORT'] = String(webPort);
process.env['SIM_WEB_ORIGIN'] = `http://localhost:${String(webPort)}`;
process.env['VITE_API_URL'] = process.env['SIM_WEB_ORIGIN'];
process.env['SIM_PROFILE'] = profile;
process.env['SIM_WITH_DOM'] = '0';
let sim: Awaited<ReturnType<typeof product.run>> | null = null;
let listener: Awaited<ReturnType<typeof listenSimHttpServer>> | null = null;
let web: ReturnType<typeof Bun.spawn> | null = null;
let stopping = false;

async function stop(): Promise<void> {
  if (stopping) return;
  stopping = true;
  web?.kill('SIGTERM');
  await web?.exited;
  await listener?.stop();
  await sim?.[Symbol.asyncDispose]();
}

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    void stop().then(() => process.exit(0));
  });
}

try {
  sim = await product.run({ seed: 1, runtime: profile });
  let surface: ProductSim | undefined;
  // A System action is the public way to inspect the running product surface.
  const capture = defineAction({
    name: 'startLocalhost.capture',
    report: false,
    act: (current: ProductSim) => {
      surface = current;
    },
  });
  await sim.apply(capture);
  if (surface === undefined) throw new Error('product surface unavailable');
  const extra = productExtra(surface);
  if (extra.http.kind !== 'localhost')
    throw new Error('localhost HTTP port missing');
  listener = await listenSimHttpServer(surface.sim);
  process.env['VITE_API_URL'] = process.env['SIM_WEB_ORIGIN'];
  process.env['LOCAL_PREVIEW_API_ORIGIN'] = listener.apiUrl;
  await run(['bun', 'run', '--filter', '@apps/client', 'build'], root);
  web = Bun.spawn(['bun', './scripts/preview-server.ts'], {
    cwd: `${root}/apps/client`,
    env: process.env,
    stdout: 'inherit',
    stderr: 'inherit',
  });
  await waitForReady(`${process.env['SIM_WEB_ORIGIN']}/ready`, web);
  process.stdout.write(`[${profile}] ${process.env['SIM_WEB_ORIGIN']}/\n`);
  await web.exited;
} finally {
  await stop();
}
