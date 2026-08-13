import type { HttpClient } from '@pkgs/http-client';

import type { EventLog } from '../events';
import type { FailWithSpec, SimMesh } from './create-sim-mesh';

export type CreateMeshedHttpArgs = {
  readonly from: string;
  readonly to: string;
  readonly raw: HttpClient;
  readonly mesh: SimMesh;
  readonly events: EventLog;
};

type Deferred<T> = {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
  readonly reject: (err: unknown) => void;
};

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (err: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function resolveRequestUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function resolveMethod(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.method) return init.method.toUpperCase();
  if (typeof input !== 'string' && !(input instanceof URL)) {
    return input.method.toUpperCase();
  }
  return 'GET';
}

function failResponse(spec: FailWithSpec): Response {
  if (spec.type === 'status') {
    return new Response(`sim failWith ${spec.status}`, { status: spec.status });
  }
  throw new TypeError(spec.error);
}

/**
 * HttpClient that routes through the mesh (partition / hold / drop / failWith)
 * and records http.request / http.response events.
 */
export function createMeshedHttp(args: CreateMeshedHttpArgs): HttpClient {
  return {
    async fetch(input, init) {
      const url = resolveRequestUrl(input);
      const method = resolveMethod(input, init);
      args.events.append({
        kind: 'http.request',
        from: args.from,
        to: args.to,
        nodeId: args.from,
        detail: `${method} ${url}`,
        meta: { method, url },
      });

      const forced = args.mesh.takeFailWith(args.from, args.to);
      if (forced) {
        return respondFailWith({ args, forced, method, url });
      }

      return routeFetch({ args, input, init, method, url });
    },
  };
}

async function respondFailWith(ctx: {
  readonly args: CreateMeshedHttpArgs;
  readonly forced: FailWithSpec;
  readonly method: string;
  readonly url: string;
}): Promise<Response> {
  const { args, forced, method, url } = ctx;
  try {
    const res = failResponse(forced);
    args.events.append({
      kind: 'http.response',
      from: args.to,
      to: args.from,
      nodeId: args.to,
      status: 'error',
      detail: `status=${res.status}`,
      meta: { method, url, status: res.status, failWith: true },
    });
    return res;
  } catch (err) {
    args.events.append({
      kind: 'http.response',
      from: args.to,
      to: args.from,
      nodeId: args.to,
      status: 'error',
      detail: String(err),
      meta: { method, url, failWith: true },
    });
    throw err;
  }
}

async function routeFetch(ctx: {
  readonly args: CreateMeshedHttpArgs;
  readonly input: RequestInfo | URL;
  readonly init: RequestInit | undefined;
  readonly method: string;
  readonly url: string;
}): Promise<Response> {
  const { args, input, init, method, url } = ctx;
  const done = deferred<Response>();
  const result = await args.mesh.send({
    from: args.from,
    to: args.to,
    kind: 'http',
    hop: 'forward',
    meta: { method, url },
    deliver: async () => {
      try {
        const res = await args.raw.fetch(input, init);
        await sendResponse({ args, done, res, method, url });
      } catch (err) {
        done.reject(err);
      }
    },
  });

  if (result === 'partitioned' || result === 'dropped') {
    args.events.append({
      kind: 'http.response',
      from: args.to,
      to: args.from,
      nodeId: args.to,
      status: 'dropped',
      detail: result,
      meta: { method, url },
    });
    throw new TypeError(`sim network: request ${result}`);
  }
  // held: deliver will run on release and resolve `done`
  return done.promise;
}

async function sendResponse(ctx: {
  readonly args: CreateMeshedHttpArgs;
  readonly done: Deferred<Response>;
  readonly res: Response;
  readonly method: string;
  readonly url: string;
}): Promise<void> {
  const { args, done, res, method, url } = ctx;
  const back = await args.mesh.send({
    from: args.to,
    to: args.from,
    kind: 'http',
    hop: 'reverse',
    meta: { method, url, status: res.status },
    deliver: () => {
      args.events.append({
        kind: 'http.response',
        from: args.to,
        to: args.from,
        nodeId: args.to,
        status: 'ok',
        detail: `status=${res.status}`,
        meta: { method, url, status: res.status },
      });
      done.resolve(res);
    },
  });
  if (back === 'partitioned' || back === 'dropped') {
    args.events.append({
      kind: 'http.response',
      from: args.to,
      to: args.from,
      nodeId: args.to,
      status: 'dropped',
      detail: `response ${back}`,
      meta: { method, url },
    });
    done.reject(new TypeError(`sim network: response ${back}`));
  }
  // held: resolve happens when reverse queue releases
}
