import type { ServerHttp } from '@libs/client-app/shell/client-env';

export type SerializedFetch = {
  readonly fetch: ServerHttp;
  /** Resolve after every in-flight request (and its queue successors) settle. */
  readonly drain: () => Promise<void>;
};

/** Serialize in-process Hono so request ALS scopes never interleave. */
export function serializeFetch(fetchFn: ServerHttp): SerializedFetch {
  let tail: Promise<unknown> = Promise.resolve();
  return {
    fetch: (input, init) => {
      const next = tail.then(() => fetchFn(input, init));
      tail = next.then(
        () => undefined,
        () => undefined
      );
      return next;
    },
    drain: async () => {
      for (let i = 0; i < 32; i += 1) {
        const snapshot = tail;
        await snapshot.then(
          () => undefined,
          () => undefined
        );
        await Promise.resolve();
        if (tail === snapshot) return;
      }
    },
  };
}
