import type { System } from '@pkgs/dst';

import {
  defineSyncSystem,
  type OpenSyncOptions,
  openSyncWorld,
  type SyncSurface,
  type SyncSystemDef,
} from '../../../sim/scenario';
import type { WorldKnobs } from '../../../sim/scenario/knobs';
import { acmeApp } from './app';

/** Framework-owned acme world: broker + server + `clientCount` clients. */
export const acmeSystem: SyncSystemDef = defineSyncSystem(acmeApp, {
  id: 'sync.acme',
});

/** Same topology, but hydrating the large-catalog session query. */
export const acmeLargeCatalogSystem: SyncSystemDef = defineSyncSystem(acmeApp, {
  id: 'sync.acme.large-catalog',
  sessionQuery: { name: 'notesLargeWorld', params: {} },
});

export type OpenAcmeOptions = {
  readonly seed: number | bigint | string;
  readonly knobs?: Partial<WorldKnobs>;
  readonly properties?: OpenSyncOptions['properties'];
  readonly networkFaults?: OpenSyncOptions['networkFaults'];
};

export async function openAcmeWorld(
  opts: OpenAcmeOptions
): Promise<SyncSurface & AsyncDisposable> {
  return openSyncWorld(acmeSystem, {
    seed: opts.seed,
    ...(opts.knobs !== undefined ? { knobs: opts.knobs } : {}),
    ...(opts.properties !== undefined ? { properties: opts.properties } : {}),
    ...(opts.networkFaults !== undefined
      ? { networkFaults: opts.networkFaults }
      : {}),
  });
}

export async function openAcmeLargeCatalogWorld(
  opts: OpenAcmeOptions
): Promise<SyncSurface & AsyncDisposable> {
  return openSyncWorld(acmeLargeCatalogSystem, {
    seed: opts.seed,
    ...(opts.knobs !== undefined ? { knobs: opts.knobs } : {}),
    ...(opts.properties !== undefined ? { properties: opts.properties } : {}),
    ...(opts.networkFaults !== undefined
      ? { networkFaults: opts.networkFaults }
      : {}),
  });
}

export type { SyncSurface, SyncSystemDef, System };
