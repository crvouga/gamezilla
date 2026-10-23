/**
 * Worker `Bindings` shape for `ApiHonoEnv`. Duplicated from
 * `libs/app-root-shared-ts/src/env.ts` (`ApiWorkerEnv`) so `@libs/auth` does not
 * depend on `@libs/server-app` (avoids a package cycle). Keep fields in sync.
 */
export type RoomNamespace = {
  idFromName(name: string): object;
  get(id: object): {
    fetch: (request: Request) => Promise<Response>;
  };
};

export type ApiWorkerBindings = {
  SECRETS_ENV?: string;
  API_URL?: string;
  DATABASE_URL?: string;
  ROOM?: RoomNamespace;
};
