import type { R2Bucket } from '@gamezilla/lib/object-store/impl-r2';

/**
 * Worker `Bindings` shape for `ApiHonoEnv`. Duplicated from
 * `packages/api/src/config/env.ts` (`ApiWorkerEnv`) so `@gamezilla/auth` does not
 * depend on `@gamezilla/api` (avoids a package cycle). Keep fields in sync.
 */
export type HyperdriveBinding = {
  readonly connectionString: string;
};

export type RoomNamespace = {
  idFromName(name: string): object;
  get(id: object): { fetch(request: Request): Promise<Response> };
};

export type ApiWorkerBindings = {
  DOPPLER_TOKEN: string;
  DOPPLER_PROJECT?: string;
  DOPPLER_CONFIG?: string;
  HYPERDRIVE: HyperdriveBinding;
  ROOM?: RoomNamespace;
  /** Cloudflare R2 bucket for cached TTS audio blobs. Optional — omit to disable TTS. */
  TTS_AUDIO?: R2Bucket;
};
