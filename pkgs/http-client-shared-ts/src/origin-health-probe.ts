import type { Clock } from '@pkgs/clock-shared-ts/types';

import type { HttpFetch } from './types';

export type HealthProbeResult = {
  readonly ok: boolean;
  readonly latencyMs: number;
};

function jsonStatusIsOk(json: unknown): boolean {
  return (
    json !== null &&
    typeof json === 'object' &&
    (json as { status?: unknown }).status === 'ok'
  );
}

/** GET health URL; success is HTTP 2xx and JSON `{ status: 'ok' }`. */
export async function probeHealthEndpoint(args: {
  readonly healthUrl: string;
  readonly fetch: HttpFetch;
  readonly clock: Clock;
  readonly signal?: AbortSignal;
}): Promise<HealthProbeResult> {
  const t0 = args.clock.now();
  const res = await args.fetch(args.healthUrl, {
    method: 'GET',
    ...(args.signal !== undefined ? { signal: args.signal } : {}),
  });
  const latencyMs = Math.round(args.clock.now() - t0);
  if (!res.ok) {
    await res.body?.cancel();
    return { ok: false, latencyMs };
  }
  try {
    const json: unknown = await res.json();
    return { ok: jsonStatusIsOk(json), latencyMs };
  } catch {
    return { ok: false, latencyMs };
  }
}

export function nextBackoffMs(current: number, max: number): number {
  const doubled = current * 2;
  return doubled > max ? max : doubled;
}
