/**
 * Inject snapshot auth KV into a Playwright page before hydrate.
 */

import { AUTH_BEARER_STORAGE_KEY } from '@pkgs/auth/client';
import type { SimSystemSnapshot } from '@pkgs/sim-console/shared/sim-system-snapshot';
import type { Page } from '@playwright/test';

export async function injectPlaywrightSnapshotAuth(args: {
  readonly page: Page;
  readonly actorId: string;
  readonly snapshot: SimSystemSnapshot;
  readonly namespace: string;
}): Promise<void> {
  const slice = args.snapshot.clients[args.actorId];
  if (slice === undefined) return;
  const entries = Object.entries(slice.kv);
  if (entries.length === 0) return;
  await args.page.addInitScript(
    ({ ns, kv, bearerKey }) => {
      for (const [rel, value] of Object.entries(kv)) {
        const key = rel === bearerKey ? bearerKey : `${ns}.${rel}`;
        globalThis.localStorage.setItem(key, value);
      }
    },
    {
      ns: args.namespace,
      kv: slice.kv,
      bearerKey: AUTH_BEARER_STORAGE_KEY,
    }
  );
}
