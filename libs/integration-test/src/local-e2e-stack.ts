import { execFileSync } from 'node:child_process';

import { DEFAULT_LOCAL_PREVIEW_API_ORIGIN } from './local-api-preview';

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
    'Start the stack (same ports for dev and QA):',
    '  bun dev       # client :5173, API :8788',
    '  bun preview   # static export on :5173, API :8788',
    '',
    'Then re-run:',
    '  bun qa:browser   or   bun pw',
    '',
  ].join('\n');
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
  return {
    baseURL: DEV_CLIENT_BASE_URL,
    readyURL: `${DEV_CLIENT_BASE_URL}/`,
  };
}
