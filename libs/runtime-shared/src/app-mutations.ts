import type { MutationRegistry } from '@pkgs/sync-engine-shared/mutations-types';

import { APP } from './app-features';

/**
 * Product mutation registry — shared by the API replay path and the client
 * runner. Behind a thunk so each feature's mutation bodies stay on their own
 * chunk boundary (the client loads them with its first sync engine).
 */
export const loadAppMutations = (): Promise<MutationRegistry> =>
  APP.mutations();
