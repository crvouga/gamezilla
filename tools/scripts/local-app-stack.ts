// @io-wall-ok — process entry helpers for the production-shaped app stack.
/**
 * Boot the full app stack on loopback: embedded Postgres + MinIO + EMQX, the
 * room Worker and API Worker under `wrangler dev`, and the built web client.
 *
 * - `dev` — `bun start:localhost`: dev database, Google OAuth, normal bundle.
 * - `e2e` — `bun e2e`: its own `e2e` database, the Dev IdP enabled on the
 *   Worker (`E2E_DEV_AUTH`), and a `VITE_E2E` bundle served by the caller's
 *   web server (test ids + harness auth-session route).
 */

import { connect } from 'node:net';
import { join } from 'node:path';
import { wallClock, wallTimers } from '@pkgs/clock';

import { bootLocalStack, type LocalStackHandle } from './boot-local-stack';

const ROOT = join(import.meta.dirname, '../..');
const API_DIR = join(ROOT, 'apps/server');
const ROOM_DIR = join(ROOT, 'apps/room-server');
const CLIENT_DIR = join(ROOT, 'apps/client');
const API_PORT = 8788;
const ROOM_PORT = 8789;
const WEB_PORT = 5173;
const POLL_MS = 250;
const READY_TIMEOUT_MS = 120_000;
/** Database on the embedded cluster that `bun e2e` resets between tests. */
export const E2E_DATABASE = 'e2e';

export const LOCAL_API_ORIGIN = `http://localhost:${String(API_PORT)}`;
export const LOCAL_WEB_ORIGIN = `http://localhost:${String(WEB_PORT)}`;

type Child = ReturnType<typeof Bun.spawn>;

export type LocalAppStackProfile = 'dev' | 'e2e';

export type LocalAppStackOptions = {
  readonly profile: LocalAppStackProfile;
  /** Web server entry (`bun <entry>`), serving the client `dist/` on :5173. */
  readonly webEntry?: string;
};

export type LocalAppStack = {
  readonly apiOrigin: string;
  readonly webOrigin: string;
  /** Database the API Worker is bound to. */
  readonly databaseUrl: string;
  /** Rejects when a long-running process exits before {@link stop}. */
  readonly exited: Promise<void>;
  stop(): Promise<void>;
};

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
      reject(
        new Error(
          `port ${String(port)} is already in use (is \`bun start:localhost\` running?)`
        )
      );
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

function profileEnv(
  profile: LocalAppStackProfile,
  databaseUrl: string
): Record<string, string> {
  if (profile === 'dev') return {};
  return { E2E_DEV_AUTH: '1', LOCAL_STACK_DATABASE_URL: databaseUrl };
}

export async function startLocalAppStack(
  options: LocalAppStackOptions
): Promise<LocalAppStack> {
  const e2e = options.profile === 'e2e';
  process.env['SECRETS_ENV'] = 'dev';
  process.env['LOCAL_PREVIEW_API_ORIGIN'] = LOCAL_API_ORIGIN;
  process.env['VITE_API_URL'] = LOCAL_API_ORIGIN;
  process.env['PREVIEW_PORT'] = String(WEB_PORT);
  if (e2e) process.env['VITE_E2E'] = '1';
  await Promise.all([
    assertPortFree(API_PORT),
    assertPortFree(ROOM_PORT),
    assertPortFree(WEB_PORT),
  ]);

  let infra: LocalStackHandle | null = null;
  const services: Child[] = [];
  const labels = new Map<Child, string>();
  const active = new Set<Child>();
  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    const pending = [...active, ...services];
    for (const child of pending) child.kill('SIGTERM');
    await Promise.all(pending.map((child) => child.exited));
    if (e2e) {
      // Leave `.dev.vars` in its dev shape for `wrangler dev` / check:api.
      await run(['bun', 'scripts/setup-dev-vars.ts'], API_DIR, active, {
        LOCAL_SECRETS: '1',
      }).catch((error: unknown) => {
        process.stderr.write(
          `[stack] restoring .dev.vars failed: ${String(error)}\n`
        );
      });
    }
    await infra?.stop();
  };

  try {
    infra = await bootLocalStack(
      e2e ? { database: E2E_DATABASE, seed: false } : {}
    );
    await run(['bun', 'scripts/setup-dev-vars.ts'], API_DIR, active, {
      LOCAL_SECRETS: '1',
      ...profileEnv(options.profile, infra.databaseUrl),
    });
    const room = start(
      [
        'bunx',
        'wrangler',
        'dev',
        '--port',
        String(ROOM_PORT),
        '--inspector-port',
        '9232',
        '--log-level',
        'warn',
      ],
      ROOM_DIR
    );
    services.push(room);
    labels.set(room, 'room Worker');
    await waitForReady(`http://localhost:${String(ROOM_PORT)}/`, room);
    const api = start(['bun', 'scripts/preview-serve.ts'], API_DIR);
    services.push(api);
    labels.set(api, 'API Worker');
    await waitForReady(`${LOCAL_API_ORIGIN}/api/health`, api);
    await run(['bun', 'run', 'setup'], CLIENT_DIR, active);
    await run(['bun', 'run', 'build'], CLIENT_DIR, active);
    const web = start(
      [
        'bun',
        options.webEntry ?? join(CLIENT_DIR, 'scripts/preview-server.ts'),
      ],
      CLIENT_DIR
    );
    services.push(web);
    labels.set(web, 'web server');
    await waitForReady(`${LOCAL_WEB_ORIGIN}/ready`, web);
  } catch (error) {
    await stop();
    throw error;
  }

  const exited = Promise.race(
    services.map((child) =>
      child.exited.then((code) => {
        if (stopping) return;
        throw new Error(
          `${labels.get(child) ?? 'stack'} exited ${String(code)}`
        );
      })
    )
  );
  return {
    apiOrigin: LOCAL_API_ORIGIN,
    webOrigin: LOCAL_WEB_ORIGIN,
    databaseUrl: infra.databaseUrl,
    exited,
    stop,
  };
}
