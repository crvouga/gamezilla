import { AsyncLocalStorage } from 'node:async_hooks';

import type { Io } from './types';

const als = new AsyncLocalStorage<Io>();

/** Run `fn` with `io` as the current async-local {@link Io}. */
export function runWithIo<T>(io: Io, fn: () => T): T {
  return als.run(io, fn);
}

/** Current {@link Io} from AsyncLocalStorage — throws if missing. */
export function getIo(): Io {
  const io = als.getStore();
  if (io === undefined) {
    throw new Error(
      'getIo: no Io in AsyncLocalStorage — call runWithIo at the composition root'
    );
  }
  return io;
}

/** Current {@link Io} or `null` when outside `runWithIo`. */
export function tryGetIo(): Io | null {
  return als.getStore() ?? null;
}
