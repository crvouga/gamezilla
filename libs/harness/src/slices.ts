/**
 * A feature's contribution to a harness, and the fold that turns a list of them
 * into a {@link HarnessComposition}.
 *
 * Each feature exports its slice from its own `./harness` surface; a suite lists
 * the slices it needs. Order is the composition root's: the harness folds
 * features, clients and servers in {@link SLICE_ORDER}, the same relative
 * order production composes them in, whatever order a suite lists them.
 */

import { AUTH_FEATURE } from '@libs/auth/root/feature';
import { CLIENT_CONFIG_FEATURE } from '@libs/client-config/root/feature';
import type { FeatureClient } from '@libs/feature/public/client';
import { composeFeatures } from '@libs/feature/public/compose';
import type { FeatureManifest } from '@libs/feature/public/manifest';
import type { FeatureServer } from '@libs/feature/public/server';
import type { EnvTime } from '@libs/feature/public/sync';
import { PERMISSIONS_FEATURE } from '@libs/permissions/root/feature';
import type { MembershipProviders, PlusMembershipOffer } from '@pkgs/billing';
import type { CatalogAction, CatalogProperty } from '@pkgs/harness';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { withHome } from './bare-home-client';
import type {
  HarnessBrowserAppPage,
  HarnessComposition,
  HarnessRoomGateway,
  HarnessRoomNode,
} from './composition';
import type { ProductHarness } from './system/harness';

export type HarnessSlice = {
  readonly name: SliceName;
  readonly feature?: FeatureManifest;
  readonly client?: FeatureClient;
  readonly server?: (deps: {
    readonly billing: MembershipProviders | null;
  }) => FeatureServer;
  readonly roomNode?: (
    env: EnvTime,
    gateway: HarnessRoomGateway
  ) => HarnessRoomNode;
  readonly seedServer?: (sqlClient: SqlClient) => Promise<void>;
  readonly browserPages?: readonly HarnessBrowserAppPage[];
  /** What this feature sells; boots the harness's payment provider. */
  readonly billingOffer?: PlusMembershipOffer;
  readonly properties?: readonly CatalogProperty<ProductHarness>[];
  readonly actions?: readonly CatalogAction<ProductHarness>[];
};

/**
 * Production's composition order (`@libs/runtime` `APP_FEATURES`,
 * `APP_FEATURE_CLIENTS`, `appFeatureServers`), which all agree on this
 * relative order. A provider mounted earlier is outermost.
 */
export const SLICE_ORDER = [
  'auth',
  'profile',
  'client-config',
  'spaces',
  'friends',
  'notifications',
  'search',
  'chess',
  'billing',
  'permissions',
] as const;

export type SliceName = (typeof SLICE_ORDER)[number];

/** Identity: every composition runs it, the shell cannot boot without it. */
export const AUTH_HARNESS_SLICE: HarnessSlice = {
  name: 'auth',
  feature: AUTH_FEATURE,
};

/** Runtime config rows the shell reads at boot. */
export const CLIENT_CONFIG_HARNESS_SLICE: HarnessSlice = {
  name: 'client-config',
  feature: CLIENT_CONFIG_FEATURE,
};

/** Permission policy; every feature's gates read it. */
export const PERMISSIONS_HARNESS_SLICE: HarnessSlice = {
  name: 'permissions',
  feature: PERMISSIONS_FEATURE,
};

/** The platform slices every composition includes. */
export const PLATFORM_HARNESS_SLICES: readonly HarnessSlice[] = [
  AUTH_HARNESS_SLICE,
  CLIENT_CONFIG_HARNESS_SLICE,
  PERMISSIONS_HARNESS_SLICE,
];

function only<T>(
  slices: readonly HarnessSlice[],
  pick: (slice: HarnessSlice) => T | undefined,
  what: string
): T | undefined {
  const found = slices
    .map(pick)
    .filter((value): value is T => value !== undefined);
  if (found.length > 1) {
    throw new Error(
      `composeHarnessSlices: more than one slice provides ${what}`
    );
  }
  return found[0];
}

/** Fold slices (plus the platform) into a composition named `name`. */
export function composeHarnessSlices(
  name: string,
  slices: readonly HarnessSlice[]
): HarnessComposition {
  const byName = new Map<SliceName, HarnessSlice>();
  for (const slice of [...PLATFORM_HARNESS_SLICES, ...slices]) {
    if (byName.has(slice.name) && !PLATFORM_HARNESS_SLICES.includes(slice)) {
      throw new Error(`composeHarnessSlices: duplicate slice '${slice.name}'`);
    }
    byName.set(slice.name, slice);
  }
  const ordered = SLICE_ORDER.flatMap((key) => {
    const slice = byName.get(key);
    return slice === undefined ? [] : [slice];
  });
  const roomNode = only(ordered, (s) => s.roomNode, 'a room node');
  const billingOffer = only(ordered, (s) => s.billingOffer, 'a billing offer');
  const seeds = ordered.flatMap((s) =>
    s.seedServer === undefined ? [] : [s.seedServer]
  );
  return {
    name,
    app: composeFeatures(
      ordered.flatMap((s) => (s.feature === undefined ? [] : [s.feature]))
    ),
    clients: withHome(
      ordered.flatMap((s) => (s.client === undefined ? [] : [s.client]))
    ),
    servers: (deps) =>
      ordered.flatMap((s) => (s.server === undefined ? [] : [s.server(deps)])),
    ...(roomNode === undefined ? {} : { roomNode }),
    ...(billingOffer === undefined ? {} : { billingOffer }),
    seedServer: async (sqlClient) => {
      for (const seed of seeds) await seed(sqlClient);
    },
    browserPages: ordered.flatMap((s) => s.browserPages ?? []),
    properties: ordered.flatMap((s) => s.properties ?? []),
    actions: ordered.flatMap((s) => s.actions ?? []),
  };
}
