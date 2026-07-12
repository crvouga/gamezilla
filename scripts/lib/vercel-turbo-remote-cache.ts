import { spawnSync } from 'node:child_process';

export const VERCEL_CACHE_API = 'https://vercel.com';

const OK_STATUSES = new Set(['ok', 'enabled']);
const REMOTE_UNAVAILABLE = 'Remote caching unavailable';
const REMOTE_AUTH_FAILED = 'Authentication failed';
export const REMOTE_WRITE_DENIED =
  'Insufficient permissions to write to remote cache';

export type TurboRemoteCacheFailure = {
  readonly kind: 'status' | 'probe';
  readonly message: string;
};

/** Turbo login OAuth tokens (`vca_`) expire quickly — not suitable for Infisical. */
export function isShortLivedTurboOAuthToken(token: string): boolean {
  return token.trim().startsWith('vca_');
}

export async function checkVercelCacheStatus(
  token: string,
  api = VERCEL_CACHE_API
): Promise<void> {
  const statusUrl = `${api.replace(/\/+$/, '')}/v8/artifacts/status`;
  let res: Response;
  try {
    res = await fetch(statusUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch (e) {
    throw new Error(
      `cache unreachable at ${statusUrl}: ${e instanceof Error ? e.message : String(e)}`
    );
  }
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `cache rejected token — HTTP ${String(res.status)} from ${statusUrl}`
    );
  }
  if (!res.ok) return;
  try {
    const body = (await res.json()) as { status?: string };
    if (typeof body.status === 'string' && !OK_STATUSES.has(body.status)) {
      throw new Error(
        `unexpected status response from ${statusUrl}: ${JSON.stringify(body)}`
      );
    }
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('unexpected status')) {
      throw e;
    }
  }
}

export function probeTurboRemoteCacheWrite(): TurboRemoteCacheFailure | null {
  const result = spawnSync(
    'bunx',
    [
      'turbo',
      'run',
      'tc',
      '--filter=@pkgs/assert',
      '--cache=local:rw,remote:rw',
      '--output-logs=none',
    ],
    {
      encoding: 'utf8',
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    }
  );

  const log = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;

  if (log.includes(REMOTE_UNAVAILABLE) || log.includes(REMOTE_AUTH_FAILED)) {
    const line =
      log
        .split('\n')
        .find(
          (l) =>
            l.includes(REMOTE_UNAVAILABLE) || l.includes(REMOTE_AUTH_FAILED)
        ) ?? REMOTE_UNAVAILABLE;
    return { kind: 'probe', message: line.trim() };
  }

  if (log.includes(REMOTE_WRITE_DENIED)) {
    return { kind: 'probe', message: REMOTE_WRITE_DENIED };
  }

  if (result.status !== 0) {
    return {
      kind: 'probe',
      message:
        `turbo probe exited ${String(result.status)}.\n` +
        (log.trim().slice(0, 600) || '(no output)'),
    };
  }

  return null;
}
