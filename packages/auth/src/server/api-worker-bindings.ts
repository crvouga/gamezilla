/**
 * Worker `Bindings` shape for `ApiHonoEnv`. Duplicated from
 * `packages/api/src/config/env.ts` (`ApiWorkerEnv`) so `@gamezilla/auth` does not
 * depend on `@gamezilla/api` (avoids a package cycle). Keep fields in sync.
 */
export type HyperdriveBinding = {
  readonly connectionString: string;
};

export type SpaceNamespace = {
  idFromName(name: string): object;
  get(id: object): { fetch(request: Request): Promise<Response> };
};

export type ApiWorkerBindings = {
  DOPPLER_TOKEN: string;
  DOPPLER_PROJECT?: string;
  DOPPLER_CONFIG?: string;
  HYPERDRIVE: HyperdriveBinding;
  SPACE?: SpaceNamespace;
};
