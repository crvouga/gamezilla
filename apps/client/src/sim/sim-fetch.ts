import type { ServerHttp } from '@apps/client/product/client-env';

/** Serialize in-process Hono so request ALS scopes never interleave. */
export function serializeFetch(fetchFn: ServerHttp): ServerHttp {
  let tail: Promise<unknown> = Promise.resolve();
  return (input, init) => {
    const next = tail.then(() => fetchFn(input, init));
    tail = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };
}
