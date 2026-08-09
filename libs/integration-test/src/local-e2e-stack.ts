// @io-wall-ok
import { execFileSync } from 'node:child_process';
import { wallIo } from '@pkgs/io';
import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from './local-api-preview';

const io = wallIo();

/** Expo web — `bun dev` (Metro) and `bun preview` (static export) both use :5173. */
export const DEV_CLIENT_PORT = 5173;

export const DEV_CLIENT_BASE_URL = `http://localhost:${String(DEV_CLIENT_PORT)}`;

export type LocalE2eStack = {
  readonly baseURL: string;
  readonly readyURL: string;
};

type StackProbe = {
  readonly label: string;
  readonly url: string;
  readonly ok: boolean;
};

function probeHttpOkSync(url: string): boolean {
  try {
    execFileSync('curl', ['-sf', '--max-time', '2', '-o', '/dev/null', url], {
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

function devStackProbes(apiOrigin: string): StackProbe[] {
  return [
    {
      label: 'API health',
      url: `${apiOrigin}/api/health`,
      ok: probeHttpOkSync(`${apiOrigin}/api/health`),
    },
    {
      label: 'Web client',
      url: `${DEV_CLIENT_BASE_URL}/`,
      ok: probeHttpOkSync(`${DEV_CLIENT_BASE_URL}/`),
    },
  ];
}

function devStackReady(apiOrigin: string): boolean {
  return devStackProbes(apiOrigin).every((probe) => probe.ok);
}

const DEFAULT_STACK_WAIT_MS = 240_000;
const STACK_POLL_MS = 1_000;

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => io.timers.setTimeout(resolve, ms));
}

/** Synchronous readiness probe for scripts that start or skip the preview stack. */
export function isLocalE2eStackReadySync(
  apiOrigin: string = DEFAULT_LOCAL_PREVIEW_API_ORIGIN
): boolean {
  return devStackReady(apiOrigin);
}

function formatProbeList(probes: StackProbe[]): string {
  return probes
    .map((probe) => `  • ${probe.label}: ${probe.url} ${probe.ok ? '✓' : '✗'}`)
    .join('\n');
}

function browserStackNotRunningMessage(apiOrigin: string): string {
  return [
    '',
    '══════════════════════════════════════════════════════════════════',
    '  Browser E2E / integration tests require a running dev stack',
    '══════════════════════════════════════════════════════════════════',
    '',
    'Integration tests do not start servers. Required endpoints:',
    formatProbeList(devStackProbes(apiOrigin)),
    '',
    'Start the stack (same ports for dev and check):',
    '  bun dev       # client :5173, API :8788',
    '  bun preview   # static export on :5173, API :8788',
    '',
    'Then re-run:',
    '  bun check:browser',
    '',
  ].join('\n');
}

function localE2eStackFromReady(apiOrigin: string): LocalE2eStack {
  void apiOrigin;
  return {
    baseURL: DEV_CLIENT_BASE_URL,
    readyURL: `${DEV_CLIENT_BASE_URL}/`,
  };
}

/**
 * Polls until API health and the web client respond, or throws after
 * `BROWSER_E2E_STACK_WAIT_MS` (default 240s).
 */
export async function waitForLocalE2eStack(
  apiOrigin: string = DEFAULT_LOCAL_PREVIEW_API_ORIGIN,
  timeoutMs: number = Number(
    process.env['BROWSER_E2E_STACK_WAIT_MS'] ?? DEFAULT_STACK_WAIT_MS
  )
): Promise<LocalE2eStack> {
  const deadline = io.clock.now() + timeoutMs;
  let lastMessage = browserStackNotRunningMessage(apiOrigin);

  while (io.clock.now() < deadline) {
    if (devStackReady(apiOrigin)) {
      return localE2eStackFromReady(apiOrigin);
    }
    lastMessage = browserStackNotRunningMessage(apiOrigin);
    await sleepMs(STACK_POLL_MS);
  }

  throw new Error(
    `[wait-for-local-e2e-stack] timed out after ${String(timeoutMs)}ms\n${lastMessage}`
  );
}

/**
 * Returns the local browser E2E stack when dev ports are healthy, or throws
 * with a loud message when nothing is running.
 */
export function requireLocalE2eStackSync(
  apiOrigin: string = DEFAULT_LOCAL_PREVIEW_API_ORIGIN
): LocalE2eStack {
  if (!devStackReady(apiOrigin)) {
    throw new Error(browserStackNotRunningMessage(apiOrigin));
  }
  return localE2eStackFromReady(apiOrigin);
}
