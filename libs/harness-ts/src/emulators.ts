/**
 * The simulated vendors of a harness, as things an operator can look into:
 * each is a Mockingbird emulator running in this process, and each serves
 * its own administration (`/__admin`, with a dashboard at `/__admin/ui`)
 * over the same `fetch` its vendor API answers on.
 */

import type { ServerHttp } from '@libs/sub-shared-ts/sync';
import type { HarnessBillingProviders } from './billing';
import type { HarnessIdps } from './idp';

export type HarnessEmulator = {
  /** Stable, URL-safe id (`google`, `stripe`, `s3`, …). */
  readonly id: string;
  /** What the vendor is to the product. */
  readonly title: string;
  /** The origin the emulator answers on inside the harness. */
  readonly origin: string;
  /** Operator access: no network hop, so it answers whatever is partitioned. */
  readonly fetch: ServerHttp;
};

/** Where every emulator serves its dashboard. */
export const HARNESS_EMULATOR_DASHBOARD_PATH = '/__admin/ui';

/** Every emulator of a harness: sign-in, payments, then the shared services. */
export function harnessEmulators(args: {
  readonly idps: HarnessIdps;
  readonly billing: HarnessBillingProviders | null;
  readonly shared: readonly HarnessEmulator[];
}): readonly HarnessEmulator[] {
  return [
    {
      id: 'google',
      title: 'Google sign-in',
      origin: args.idps.google.origin,
      fetch: args.idps.google.fetch,
    },
    {
      id: 'apple',
      title: 'Apple sign-in',
      origin: args.idps.apple.origin,
      fetch: args.idps.apple.fetch,
    },
    ...(args.billing?.all() ?? []).map((provider) => ({
      id: provider.id,
      title: `Payments (${provider.id})`,
      origin: provider.origin,
      fetch: provider.fetch,
    })),
    ...args.shared,
  ];
}
