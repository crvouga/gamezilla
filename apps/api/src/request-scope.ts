import { AsyncLocalStorage } from 'node:async_hooks';
import type { PatchDb } from '@gamezilla/patch-db/interface';
import type { SessionAuth } from './auth/session-middleware';

/**
 * Request-scoped {@link PatchDb} for the patch-db sync host resolver
 * (`PatchDbResolvable` function). Populated by {@link ./app/create-app.ts} middleware.
 */
export type ApiRequestAsyncStore = {
  readonly patchDb: PatchDb;
  readonly sessionAuth: SessionAuth;
};

export const apiRequestAsyncLocalStorage =
  new AsyncLocalStorage<ApiRequestAsyncStore>();
