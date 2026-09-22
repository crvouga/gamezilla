/**
 * A feature's contribution to a sim, and the fold that turns a list of them
 * into a {@link SimComposition}.
 *
 * Each feature exports its slice from its own `./sim` surface; a suite lists
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
import type { CatalogAction, CatalogProperty } from '@pkgs/sim';
import type { SqlClient } from '@pkgs/sql-client/interface';
import { withHome } from './bare-home-client';
import type {
  SimBrowserAppPage,
  SimComposition,
  SimRoomNode,
} from './composition';
import type { ProductSim } from './system/sim';

export type SimSlice = {
  readonly name: SliceName;
  readonly feature?: FeatureManifest;
  readonly client?: FeatureClient;
  readonly server?: (deps: {
    readonly billing: MembershipProviders | null;
  }) => FeatureServer;
  readonly roomNode?: (env: EnvTime) => SimRoomNode;
  readonly seedServer?: (sqlClient: SqlClient) => Promise<void>;
  readonly browserPages?: readonly SimBrowserAppPage[];
  /** What this feature sells; boots the sim's payment provider. */
  readonly billingOffer?: PlusMembershipOffer;
  readonly properties?: readonly CatalogProperty<ProductSim>[];
  readonly actions?: readonly CatalogAction<ProductSim>[];
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
export const AUTH_SIM_SLICE: SimSlice = { name: 'auth', feature: AUTH_FEATURE };

/** Runtime config rows the shell reads at boot. */
export const CLIENT_CONFIG_SIM_SLICE: SimSlice = {
  name: 'client-config',
  feature: CLIENT_CONFIG_FEATURE,
};

/** Permission policy; every feature's gates read it. */
export const PERMISSIONS_SIM_SLICE: SimSlice = {
  name: 'permissions',
  feature: PERMISSIONS_FEATURE,
};

/** The platform slices every composition includes. */
export const PLATFORM_SIM_SLICES: readonly SimSlice[] = [
  AUTH_SIM_SLICE,
  CLIENT_CONFIG_SIM_SLICE,
  PERMISSIONS_SIM_SLICE,
];

function only<T>(
  slices: readonly SimSlice[],
  pick: (slice: SimSlice) => T | undefined,
  what: string
): T | undefined {
  const found = slices
    .map(pick)
    .filter((value): value is T => value !== undefined);
  if (found.length > 1) {
    throw new Error(`composeSimSlices: more than one slice provides ${what}`);
  }
  return found[0];
}

/** Fold slices (plus the platform) into a composition named `name`. */
export function composeSimSlices(
  name: string,
  slices: readonly SimSlice[]
): SimComposition {
  const byName = new Map<SliceName, SimSlice>();
  for (const slice of [...PLATFORM_SIM_SLICES, ...slices]) {
    if (byName.has(slice.name) && !PLATFORM_SIM_SLICES.includes(slice)) {
      throw new Error(`composeSimSlices: duplicate slice '${slice.name}'`);
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
