import type { ServerHttp } from '@libs/sub-shared-ts/sync';
import { HttpAbortError } from '@pkgs/http-client-shared-ts/http-abort-error';
import { requestMethod, requestPath } from './http-request';
import { HttpResponseBarrier } from './http-response-barrier';

export type HttpFaultStage = 'direct' | 'ingress' | 'server';

/** Independent HTTP faults, including accepted writes with missing acknowledgements. */
export class HttpResponseFaults {
  private readonly held = new Map<string, HttpResponseBarrier>();
  private readonly barriers = new Set<HttpResponseBarrier>();
  hold = (
    fromId: string,
    path: string,
    options: { readonly admitted?: boolean } = {}
  ): HttpResponseBarrier => {
    const key = `${fromId}:${path}`;
    const existing = this.held.get(key);
    if (existing !== undefined) return existing;
    const barrier = new HttpResponseBarrier(options.admitted ?? false);
    this.held.set(key, barrier);
    this.barriers.add(barrier);
    return barrier;
  };
  dispose = (): void => {
    for (const barrier of this.barriers) barrier.dispose();
    this.barriers.clear();
    this.held.clear();
  };
  release = (fromId: string, path: string): void => {
    const key = `${fromId}:${path}`;
    this.held.get(key)?.release();
    this.held.delete(key);
  };
  wrap(
    fromId: string,
    assertReachable: () => void,
    inner: ServerHttp,
    stage: HttpFaultStage = 'direct'
  ): ServerHttp {
    return async (input, init) => {
      assertReachable();
      const request = input instanceof Request ? input : null;
      const path = requestPath(input);
      const method = requestMethod(input, init);
      const barrier =
        method === 'POST' ? this.held.get(`${fromId}:${path}`) : undefined;
      if (
        barrier === undefined ||
        (stage === 'ingress' && barrier.admitted) ||
        (stage === 'server' && !barrier.admitted)
      )
        return inner(input, init);
      if (barrier.admitted) {
        // Own the complete body before admitting it. Client abort and later
        // client-path loss cannot erase a request already at server ingress.
        const incoming = new Request(input, { ...init, signal: null });
        const body = await incoming.arrayBuffer();
        if ((init?.signal ?? request?.signal)?.aborted)
          throw new HttpAbortError();
        const admitted = new Request(incoming, { body, signal: null });
        return barrier.cross(
          () => inner(admitted),
          init?.signal ?? request?.signal ?? null
        );
      }
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
