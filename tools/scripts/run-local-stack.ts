// @io-wall-ok — local process entry for the production-shaped app stack.
import { connect } from 'node:net';
import { join } from 'node:path';
import { wallClock, wallTimers } from '@pkgs/clock';

import { bootLocalStack, type LocalStackHandle } from './boot-local-stack';

const ROOT = join(import.meta.dirname, '../..');
const API_DIR = join(ROOT, 'apps/server');
const ROOM_DIR = join(ROOT, 'apps/room-server');
const CLIENT_DIR = join(ROOT, 'apps/client');
const API_ORIGIN = 'http://localhost:8788';
const WEB_ORIGIN = 'http://localhost:5173';
const POLL_MS = 250;
const READY_TIMEOUT_MS = 120_000;

type Child = ReturnType<typeof Bun.spawn>;

async function run(
  args: string[],
  cwd: string,
  active: Set<Child>,
  extraEnv: Record<string, string> = {}
): Promise<void> {
  const child = Bun.spawn(args, {
    cwd,
    env: { ...process.env, ...extraEnv },
    stdout: 'inherit',
    stderr: 'inherit',
  });
  active.add(child);
  try {
    const code = await child.exited;
    if (code !== 0) throw new Error(`${args.join(' ')} exited ${String(code)}`);
  } finally {
    active.delete(child);
  }
}

async function assertPortFree(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      reject(new Error(`port ${String(port)} is already in use`));
    });
    socket.once('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'ECONNREFUSED') resolve();
      else reject(error);
    });
    socket.setTimeout(1_000, () => {
      socket.destroy();
      reject(new Error(`timed out checking port ${String(port)}`));
    });
  });
}

async function waitForReady(url: string, child: Child): Promise<void> {
  const ready = async () => {
    const deadline = wallClock.now() + READY_TIMEOUT_MS;
    while (wallClock.now() < deadline) {
      try {
        const response = await fetch(url);
        if (response.ok) return;
      } catch {
        // Startup has not reached its HTTP listener yet.
      }
      await new Promise<void>((resolve) =>
        wallTimers.setTimeout(resolve, POLL_MS)
      );
    }
    throw new Error(`timed out waiting for ${url}`);
  };
  await Promise.race([
    ready(),
    child.exited.then((code) => {
      throw new Error(`process for ${url} exited ${String(code)} before ready`);
    }),
  ]);
}

function start(args: string[], cwd: string): Child {
  return Bun.spawn(args, {
    cwd,
    env: process.env,
    stdout: 'inherit',
    stderr: 'inherit',
  });
}

async function main(): Promise<void> {
  process.env['SECRETS_ENV'] = 'dev';
  process.env['LOCAL_PREVIEW_API_ORIGIN'] = API_ORIGIN;
  process.env['VITE_API_URL'] = API_ORIGIN;
  process.env['PREVIEW_PORT'] = '5173';
  await Promise.all([
    assertPortFree(8788),
    assertPortFree(8789),
    assertPortFree(5173),
  ]);

  let infra: LocalStackHandle | null = null;
  let api: Child | null = null;
  let room: Child | null = null;
  let web: Child | null = null;
  const active = new Set<Child>();
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    const pending = [...active];
    for (const child of pending) child.kill('SIGTERM');
    web?.kill('SIGTERM');
    api?.kill('SIGTERM');
    room?.kill('SIGTERM');
    await Promise.all([
      ...pending.map((child) => child.exited),
      web?.exited,
      api?.exited,
      room?.exited,
    ]);
    await infra?.stop();
  };
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
      void stop().then(() => process.exit(0));
    });
  }

  try {
    infra = await bootLocalStack();
    await run(['bun', 'scripts/setup-dev-vars.ts'], API_DIR, active, {
      LOCAL_SECRETS: '1',
    });
    room = start(
      [
        'bunx',
        'wrangler',
        'dev',
        '--port',
        '8789',
        '--inspector-port',
        '9232',
        '--log-level',
        'warn',
      ],
      ROOM_DIR
    );
    await waitForReady('http://localhost:8789/', room);
    api = start(['bun', 'scripts/preview-serve.ts'], API_DIR);
    await waitForReady(`${API_ORIGIN}/api/health`, api);
    await run(['bun', 'run', 'setup'], CLIENT_DIR, active);
    await run(['bun', 'run', 'build'], CLIENT_DIR, active);
    web = start(['bun', 'scripts/preview-server.ts'], CLIENT_DIR);
    await waitForReady(`${WEB_ORIGIN}/ready`, web);

    process.stdout.write(`\n[stack] client  ${WEB_ORIGIN}/\n`);
    process.stdout.write(`[stack] API     ${API_ORIGIN}/api/health\n`);
    process.stdout.write('[stack] MinIO   http://127.0.0.1:9001/\n');
    process.stdout.write('[stack] EMQX    http://127.0.0.1:18083/\n');
    process.stdout.write('[stack] ready (Ctrl-C to stop)\n');
    await Promise.race([
      api.exited.then((code) => {
        if (stopping) return;
        throw new Error(`API exited ${String(code)}`);
      }),
      web.exited.then((code) => {
        if (stopping) return;
        throw new Error(`client preview exited ${String(code)}`);
      }),
      room.exited.then((code) => {
        if (stopping) return;
        throw new Error(`room server exited ${String(code)}`);
      }),
    ]);
  } finally {
    await stop();
  }
}

await main();
