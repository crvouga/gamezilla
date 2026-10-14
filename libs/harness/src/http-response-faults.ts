import type { ServerHttp } from '@libs/sub-shared/sync';
import { requestMethod, requestPath } from './http-request';
import { HttpResponseBarrier } from './http-response-barrier';

/** Independent HTTP faults, including accepted writes with missing acknowledgements. */
export class HttpResponseFaults {
  private readonly held = new Map<string, HttpResponseBarrier>();
  hold = (fromId: string, path: string): HttpResponseBarrier => {
    const key = `${fromId}:${path}`;
    const existing = this.held.get(key);
    if (existing !== undefined) return existing;
    const barrier = new HttpResponseBarrier();
    this.held.set(key, barrier);
    return barrier;
  };
  release = (fromId: string, path: string): void => {
    const key = `${fromId}:${path}`;
    this.held.get(key)?.release();
    this.held.delete(key);
  };
  wrap(
    fromId: string,
    assertReachable: () => void,
    inner: ServerHttp
  ): ServerHttp {
    return async (input, init) => {
      assertReachable();
      const request = input instanceof Request ? input : null;
      const path = requestPath(input);
      const method = requestMethod(input, init);
      const barrier =
        method === 'POST' ? this.held.get(`${fromId}:${path}`) : undefined;
      if (barrier === undefined) return inner(input, init);
      return barrier.cross(
        () => {
          assertReachable();
          return inner(input, init);
        },
        init?.signal ?? request?.signal ?? null
      );
    };
  }
}
