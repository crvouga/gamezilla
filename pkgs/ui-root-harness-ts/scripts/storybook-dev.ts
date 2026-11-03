// @io-wall-ok — supervised local development process entry.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { storybookNetwork } from '../storybook/network';

const pkg = join(import.meta.dirname, '..');
const network = storybookNetwork(process.env);
const localUrl = `http://${network.host}:${network.port}`;
const manifestPath = join(pkg, '.cache/storybook-dev.json');
mkdirSync(dirname(manifestPath), { recursive: true });
if (existsSync(manifestPath)) {
  const previous = JSON.parse(readFileSync(manifestPath, 'utf8')) as {
    pid: number;
    status: string;
    localUrl: string;
  };
  let active = false;
  try {
    process.kill(previous.pid, 0);
    active = previous.status !== 'stopped';
  } catch {
    /* A stale manifest belongs to an exited launcher. */
  }
  if (active)
    throw new Error(
      `Storybook is already starting or running at ${previous.localUrl}. Stop local services or use another worktree.`
    );
}
function record(status: 'starting' | 'ready' | 'stopped') {
  writeFileSync(
    manifestPath,
    `${JSON.stringify({ status, pid: process.pid, host: network.host, port: network.port, localUrl }, null, 2)}\n`
  );
}
record('starting');
console.log(`[storybook] Local: ${localUrl}`);
const require = createRequire(import.meta.url);
const cli = join(
  dirname(require.resolve('storybook/package.json')),
  'dist/bin/dispatcher.js'
);
const child = spawn(
  process.execPath,
  [
    cli,
    'dev',
    '--ci',
    '--no-open',
    '--exact-port',
    '-c',
    'storybook',
    '--host',
    network.host,
    '-p',
    String(network.port),
    ...process.argv.slice(2),
  ],
  { cwd: pkg, stdio: 'inherit' }
);
const stop = () => child.kill('SIGTERM');
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, stop);
let exited = false;
async function ready() {
  while (!exited) {
    try {
      const response = await fetch(`${localUrl}/index.json`, {
        signal: AbortSignal.timeout(1000),
      });
      if (response.ok) {
        record('ready');
        return;
      }
    } catch {
      /* Startup has not opened its listener yet. */
    }
    await Bun.sleep(100);
  }
}
void ready();
const code = await new Promise<number>((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (status) => resolve(status ?? 1));
});
exited = true;
record('stopped');
process.exit(code);
