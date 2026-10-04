import type { AuthClientPort } from '@pkgs/auth-root-shared/auth-client-port';
import type { Timers } from '@pkgs/clock-shared/types';

const BEARER_RETRY_DELAYS_MS = [0, 300, 1000, 2000] as const;

async function sleepMs(ms: number, timers: Timers): Promise<void> {
  await new Promise<void>((resolve) => {
    timers.setTimeout(resolve, ms);
  });
}

export type ResolveSessionBearerTokenOptions = {
  /** Override retry cadence (tests). */
  readonly delaysMs?: readonly number[];
};

/**
 * Cookie sessions can hydrate before IdP captures `set-auth-token`.
 * Prefer the cached bearer, then force a get-session mint, with short retries
 * so AuthBridge does not permanently skip writing product `sessionToken`.
 */
export class SessionBearerTokenResolver {
  constructor(private readonly timers: Timers) {}

  async resolve(
    port: Pick<AuthClientPort, 'getFreshToken'>,
    options?: ResolveSessionBearerTokenOptions
  ): Promise<string | null> {
    const delays = options?.delaysMs ?? BEARER_RETRY_DELAYS_MS;
    for (const delay of delays) {
      if (delay > 0) await sleepMs(delay, this.timers);
      const cached = await port.getFreshToken();
      if (cached !== null) return cached;
      const minted = await port.getFreshToken({ skipCache: true });
      if (minted !== null) return minted;
    }
    return null;
  }
}
