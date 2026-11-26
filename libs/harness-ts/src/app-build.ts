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
  /** Settles once every device watching `clientId` runs `build`. */
  readonly set: (clientId: string, build: HarnessAppBuild) => Promise<void>;
  /** Hear each later change of `clientId`'s build. Returns the unsubscribe. */
  readonly watch: (
    clientId: string,
    listener: (build: HarnessAppBuild) => Promise<void>
  ) => () => void;
};

export function createHarnessAppBuilds(): HarnessAppBuilds {
  const outdated = new Set<string>();
  const listeners = new Map<
    string,
    Set<(build: HarnessAppBuild) => Promise<void>>
  >();
  return {
    of: (clientId) => (outdated.has(clientId) ? 'outdated' : 'current'),
    set: async (clientId, build) => {
      if (build === 'outdated') outdated.add(clientId);
      else outdated.delete(clientId);
      const watching = [...(listeners.get(clientId) ?? [])];
      await Promise.all(watching.map((listener) => listener(build)));
    },
    watch: (clientId, listener) => {
      const forClient = listeners.get(clientId) ?? new Set();
      listeners.set(clientId, forClient);
      forClient.add(listener);
      return () => {
        forClient.delete(listener);
        if (forClient.size === 0 && listeners.get(clientId) === forClient)
          listeners.delete(clientId);
      };
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

type AppBuildPage = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
  __harnessAppBuild?: HarnessAppBuild;
  __harnessAppBuildFetch?: true;
};

/**
 * Runs inside a browser device's page (serialized, so it closes over
 * nothing): the page's fetch sends what `build` sends. Installs its fetch
 * wrapper once per document; later calls only change the build.
 */
function setPageAppBuild(
  page: AppBuildPage,
  build: HarnessAppBuild,
  header: string,
  outdatedProtocol: string
): void {
  page.__harnessAppBuild = build;
  if (page.__harnessAppBuildFetch === true) return;
  page.__harnessAppBuildFetch = true;
  const sent = page.fetch;
  page.fetch = (input, init) => {
    if (page.__harnessAppBuild !== 'outdated')
      return sent.call(page, input, init);
    const headers = new Headers(
      init?.headers ?? (input instanceof Request ? input.headers : undefined)
    );
    if (!headers.has(header)) return sent.call(page, input, init);
    headers.set(header, outdatedProtocol);
    return sent.call(page, input, { ...init, headers });
  };
}

/** Page script putting a browser device's open document on `build`. */
export function pageAppBuildScript(build: HarnessAppBuild): string {
  const args = [build, SYNC_PROTOCOL_HEADER, OUTDATED_SYNC_PROTOCOL].map(
    (arg) => JSON.stringify(arg)
  );
  return `(${setPageAppBuild.toString()})(window, ${args.join(', ')})`;
}
