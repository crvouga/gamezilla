/**
 * Worker `Bindings` shape for `ApiHonoEnv`. Duplicated from
 * `apps/api/src/config/env.ts` (`ApiWorkerEnv`) so `@libs/auth` does not
 * depend on `@apps/api` (avoids a package cycle). Keep fields in sync.
 */
import type { R2Bucket } from '@pkgs/object-store/impl-r2';

export type RoomNamespace = {
  idFromName(name: string): object;
  get(id: object): { fetch(request: Request): Promise<Response> };
};

export type ApiWorkerBindings = {
  DOPPLER_TOKEN: string;
  DOPPLER_PROJECT?: string;
  DOPPLER_CONFIG?: string;
  OBJECT_STORE?: R2Bucket;
  ROOM?: RoomNamespace;
};
