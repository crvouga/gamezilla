/**
 * Which build of the app each simulated device runs. A device on an
 * `outdated` build speaks the sync protocol the product used before its last
 * cut, so the real server gate answers it `upgrade_required` — exactly what an
 * old install sees after the product moved on. Updating puts the device back
 * on the current build. The build belongs to the device, so it outlives an
 * app restart.
 */

import type { ServerHttp } from '@libs/sub-shared-ts/sync';
import {
  SYNC_PROTOCOL_HEADER,
  SYNC_PROTOCOL_VERSION,
} from '@pkgs/sync-engine-shared-ts/v2';

export type HarnessAppBuild = 'current' | 'outdated';

/** The protocol an outdated build speaks: the one before the current cut. */
const OUTDATED_SYNC_PROTOCOL = String(SYNC_PROTOCOL_VERSION - 1);

export type HarnessAppBuilds = {
  readonly of: (clientId: string) => HarnessAppBuild;
  readonly set: (clientId: string, build: HarnessAppBuild) => void;
};

export function createHarnessAppBuilds(): HarnessAppBuilds {
  const outdated = new Set<string>();
  return {
    of: (clientId) => (outdated.has(clientId) ? 'outdated' : 'current'),
    set: (clientId, build) => {
      if (build === 'outdated') outdated.add(clientId);
      else outdated.delete(clientId);
    },
  };
}

function outdatedInit(input: RequestInfo | URL, init?: RequestInit) {
  const headers = new Headers(
    init?.headers ?? (input instanceof Request ? input.headers : undefined)
  );
  if (!headers.has(SYNC_PROTOCOL_HEADER)) return init;
  headers.set(SYNC_PROTOCOL_HEADER, OUTDATED_SYNC_PROTOCOL);
  return { ...init, headers };
}

/** `clientId`'s server HTTP as its current build sends it. */
export function appBuildFetch(
  builds: HarnessAppBuilds,
  clientId: string,
  inner: ServerHttp
): ServerHttp {
  return (input, init) =>
    builds.of(clientId) === 'outdated'
      ? inner(input, outdatedInit(input, init))
      : inner(input, init);
}
