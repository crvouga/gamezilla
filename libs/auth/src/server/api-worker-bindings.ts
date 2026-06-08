/**
 * Worker `Bindings` shape for `ApiHonoEnv`. Duplicated from
 * `apps/api/src/config/env.ts` (`ApiWorkerEnv`) so `@libs/auth` does not
 * depend on `@apps/api` (avoids a package cycle). Keep fields in sync.
 */
export type RoomNamespace = {
  idFromName(name: string): object;
  get(id: object): { fetch(request: Request): Promise<Response> };
};

export type ApiWorkerBindings = {
  VAULT_TOKEN: string;
  VAULT_PROJECT?: string;
  VAULT_CONFIG?: string;
  VAULT_ADDR?: string;
  ROOM?: RoomNamespace;
};
