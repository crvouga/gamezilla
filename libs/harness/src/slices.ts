/**
 * A sub's contribution to a harness, and the fold that turns a list of them
 * into a {@link HarnessComposition}.
 *
 * Each sub exports its slice from its own `./harness` surface; a suite lists
 * the slices it needs. Order is the composition root's: the harness folds
 * subs in {@link SLICE_ORDER}, the same relative order production composes
 * them in, whatever order a suite lists them.
 */

import { CLIENT_CONFIG_SUB } from '@libs/app-config-shared/sub';
import { AUTH_SUB } from '@libs/auth-shared/sub';
import { PERMISSIONS_SUB } from '@libs/permissions-shared/sub';
import type { SubClient } from '@libs/sub-client/client';
import { composeSubs } from '@libs/sub-shared/compose';
import type { SubManifest } from '@libs/sub-shared/manifest';
import type { SubServer } from '@libs/sub-shared/server';
import type { EnvTime } from '@libs/sub-shared/sync';
import { SYNTHETIC_POPULATION_SUB } from '@libs/synthetic-population-shared/sub';
import type { PlusMembershipOffer } from '@pkgs/billing-root-shared/offer';
import type { MembershipProviders } from '@pkgs/billing-root-shared/providers';
import type {
  CatalogAction,
  CatalogProperty,
} from '@pkgs/harness-root-shared/effect';
import type { RoomServicePort } from '@pkgs/room-root-shared/room-service';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import { withHome } from './bare-home-client';
import type {
  HarnessComposition,
  HarnessEmailLinks,
  HarnessRoomGateway,
  HarnessRoomNode,
} from './composition';
import type { ProductHarness } from './harness';

export type HarnessSlice = {
  readonly name: SliceName;
  readonly sub?: SubManifest;
  readonly client?: SubClient;
  readonly server?: (deps: {
    readonly billing: MembershipProviders | null;
    readonly rooms: RoomServicePort;
    readonly app: ReturnType<typeof composeSubs>;
  }) => SubServer;
  readonly roomNode?: (
    env: EnvTime,
    gateway: HarnessRoomGateway
  ) => HarnessRoomNode;
  readonly seedServer?: (sqlClient: SqlClient) => Promise<void>;
  /** What this sub sells; boots the harness's payment provider. */
  readonly billingOffer?: PlusMembershipOffer;
  /** Where this sub keeps the auth service's emailed sign-in links. */
  readonly emailLinks?: HarnessEmailLinks;
  readonly properties?: readonly CatalogProperty<ProductHarness>[];
  readonly actions?: readonly CatalogAction<ProductHarness>[];
};

/**
 * Production's composition order (`@libs/runtime` `APP_SUBS`,
 * `APP_SUB_CLIENTS`, `appSubServers`), which all agree on this
 * relative order. A provider mounted earlier is outermost. `games` stands
 * for every game's own slice (`game:<id>`), in the order a suite lists
 * them, so a game's sub needs no entry here.
 */
export const SLICE_ORDER = [
  'auth',
  'profile',
  'account-privacy',
  'client-config',
  'spaces',
  'friends',
  'notifications',
  'search',
  'game-puzzle',
  'games',
  'game-session',
  'billing',
  'permissions',
  'synthetic-population',
] as const;

/** The slice of one game's own sub (its own screens' data, beside the shared ones). */
export type GameSliceName = `game:${string}`;

export type SliceName =
  | Exclude<(typeof SLICE_ORDER)[number], 'games'>
  | GameSliceName;

const isGameSlice = (name: SliceName): name is GameSliceName =>
  name.startsWith('game:');

/** Identity: every composition runs it, the shell cannot boot without it. */
export const AUTH_HARNESS_SLICE: HarnessSlice = {
  name: 'auth',
  sub: AUTH_SUB,
};

/** Runtime config rows the shell reads at boot. */
export const CLIENT_CONFIG_HARNESS_SLICE: HarnessSlice = {
  name: 'client-config',
  sub: CLIENT_CONFIG_SUB,
};

/** Permission policy; every sub's gates read it. */
export const PERMISSIONS_HARNESS_SLICE: HarnessSlice = {
  name: 'permissions',
  sub: PERMISSIONS_SUB,
};

/**
 * The Synthetic Population's tables: auth classifies every signed-in session
 * against its directory, so they exist wherever a person signs in. A suite
 * that runs the population lists the sub's own slice, which replaces this.
 */
export const SYNTHETIC_POPULATION_DIRECTORY_HARNESS_SLICE: HarnessSlice = {
  name: 'synthetic-population',
  sub: SYNTHETIC_POPULATION_SUB,
};

/** The platform slices every composition includes. */
export const PLATFORM_HARNESS_SLICES: readonly HarnessSlice[] = [
  AUTH_HARNESS_SLICE,
  CLIENT_CONFIG_HARNESS_SLICE,
  PERMISSIONS_HARNESS_SLICE,
  SYNTHETIC_POPULATION_DIRECTORY_HARNESS_SLICE,
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
  const byName = new Map<SliceName, HarnessSlice>(
    PLATFORM_HARNESS_SLICES.map((slice) => [slice.name, slice])
  );
  const listed = new Set<SliceName>();
  for (const slice of slices) {
    if (listed.has(slice.name)) {
      throw new Error(`composeHarnessSlices: duplicate slice '${slice.name}'`);
    }
    listed.add(slice.name);
    // A suite's slice for a platform sub replaces the platform's bare one.
    byName.set(slice.name, slice);
  }
  const ordered = SLICE_ORDER.flatMap((key) => {
    if (key === 'games')
      return [...byName.values()].filter((slice) => isGameSlice(slice.name));
    const slice = byName.get(key);
    return slice === undefined ? [] : [slice];
  });
  const roomNode = only(ordered, (s) => s.roomNode, 'a room node');
  const billingOffer = only(ordered, (s) => s.billingOffer, 'a billing offer');
  const emailLinks = only(
    ordered,
    (s) => s.emailLinks,
    'emailed sign-in links'
  );
  const seeds = ordered.flatMap((s) =>
    s.seedServer === undefined ? [] : [s.seedServer]
  );
  const app = composeSubs(
    ordered.flatMap((s) => (s.sub === undefined ? [] : [s.sub]))
  );
  return {
    name,
    app,
    clients: withHome(
      ordered.flatMap((s) => (s.client === undefined ? [] : [s.client]))
    ),
    servers: (deps) =>
      ordered.flatMap((s) =>
        s.server === undefined ? [] : [s.server({ ...deps, app })]
      ),
    ...(roomNode === undefined ? {} : { roomNode }),
    ...(billingOffer === undefined ? {} : { billingOffer }),
    ...(emailLinks === undefined ? {} : { emailLinks }),
    seedServer: async (sqlClient) => {
      for (const seed of seeds) await seed(sqlClient);
    },
    properties: ordered.flatMap((s) => s.properties ?? []),
    actions: ordered.flatMap((s) => s.actions ?? []),
  };
}
