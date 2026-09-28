/**
 * Round-robin load balancer node in front of the harness server instances.
 *
 * Production shape: clients never address an API instance directly — they hit
 * the balancer, which fans requests across the healthy stateless instances
 * sharing one Postgres / Kv / ObjectStore. Crashing one instance therefore
 * degrades throughput instead of taking the product down, which is exactly the
 * fault the single-server fabric could not express.
 *
 * Reachability is checked on both hops (`client-a → lb`, `lb → server-a`), so
 * partitioning a client from a server instance still isolates that hop even
 * though the request now travels through the balancer.
 */

import type { ServerHttp } from '@libs/client-app/shell/client-env';
import { requestMethod, requestPath } from './http-request';
import { type HarnessNet, harnessCrashedError } from './net';

export const HARNESS_LOAD_BALANCER_ID = 'lb';

const RECENT_ROUTE_LIMIT = 50;

export type HarnessLoadBalancerRoute = {
  readonly at: number;
  readonly from: string;
  /** Chosen backend id, or `null` when every backend was unreachable. */
  readonly to: string | null;
  readonly method: string;
  readonly path: string;
};

export type HarnessLoadBalancerBackendStat = {
  readonly id: string;
  readonly reachable: boolean;
  readonly requests: number;
};

export type HarnessLoadBalancerSnapshot = {
  readonly id: string;
  readonly algorithm: 'round-robin';
  /** Next backend index the rotation will try. */
  readonly cursor: number;
  readonly requests: number;
  readonly rejected: number;
  readonly backends: readonly HarnessLoadBalancerBackendStat[];
  readonly recentRoutes: readonly HarnessLoadBalancerRoute[];
};

export type HarnessLoadBalancerBackend = {
  readonly id: string;
  readonly fetch: ServerHttp;
};

export type HarnessLoadBalancer = {
  readonly id: string;
  /** HTTP port handed to one client; round-robins across healthy backends. */
  fetchFrom(fromId: string): ServerHttp;
  inspect(): HarnessLoadBalancerSnapshot;
  /** Route decisions, newest last — console log / topology feed. */
  onRoute(listener: (route: HarnessLoadBalancerRoute) => void): () => void;
};

type LoadBalancerState = {
  cursor: number;
  requests: number;
  rejected: number;
  readonly requestsByBackend: Map<string, number>;
  readonly recentRoutes: HarnessLoadBalancerRoute[];
  readonly routeListeners: Set<(route: HarnessLoadBalancerRoute) => void>;
};

function recordRoute(
  state: LoadBalancerState,
  route: HarnessLoadBalancerRoute
) {
  state.recentRoutes.push(route);
  if (state.recentRoutes.length > RECENT_ROUTE_LIMIT) {
    state.recentRoutes.shift();
  }
  for (const listener of [...state.routeListeners]) {
    try {
      listener(route);
    } catch {
      // console log sinks must never break routing
    }
  }
}

export function createHarnessLoadBalancer(args: {
  readonly id?: string;
  readonly net: HarnessNet;
  readonly now: () => number;
  readonly listBackends: () => readonly HarnessLoadBalancerBackend[];
}): HarnessLoadBalancer {
  const id = args.id ?? HARNESS_LOAD_BALANCER_ID;
  const state: LoadBalancerState = {
    cursor: 0,
    requests: 0,
    rejected: 0,
    requestsByBackend: new Map(),
    recentRoutes: [],
    routeListeners: new Set(),
  };

  /** First backend reachable from both the balancer and the caller. */
  function pickBackend(fromId: string): HarnessLoadBalancerBackend | null {
    const backends = args.listBackends();
    if (backends.length === 0) return null;
    for (let step = 0; step < backends.length; step += 1) {
      const index = (state.cursor + step) % backends.length;
      const candidate = backends[index];
      if (candidate === undefined) continue;
      if (
        args.net.isReachable(id, candidate.id) &&
        args.net.isReachable(fromId, candidate.id)
      ) {
        state.cursor = (index + 1) % backends.length;
        return candidate;
      }
    }
    return null;
  }

  /** Faithful fault for the caller when no backend can serve the request. */
  function noBackendError(fromId: string): Error {
    const backends = args.listBackends();
    if (backends.length === 0) return harnessCrashedError(id);
    for (const backend of backends) {
      try {
        args.net.assertReachable(id, backend.id);
        args.net.assertReachable(fromId, backend.id);
      } catch (err) {
        if (err instanceof Error) return err;
      }
    }
    return harnessCrashedError(id);
  }

  return {
    id,
    fetchFrom(fromId) {
      return args.net.wrapHop(fromId, id, async (input, init) => {
        const wire = {
          at: args.now(),
          from: fromId,
          method: requestMethod(input, init),
          path: requestPath(input),
        };
        const backend = pickBackend(fromId);
        if (backend === null) {
          state.rejected += 1;
          recordRoute(state, { ...wire, to: null });
          throw noBackendError(fromId);
        }
        state.requests += 1;
        state.requestsByBackend.set(
          backend.id,
          (state.requestsByBackend.get(backend.id) ?? 0) + 1
        );
        recordRoute(state, { ...wire, to: backend.id });
        return backend.fetch(input, init);
      });
    },
    inspect() {
      const backends = args.listBackends();
      return {
        id,
        algorithm: 'round-robin',
        cursor: backends.length === 0 ? 0 : state.cursor % backends.length,
        requests: state.requests,
        rejected: state.rejected,
        backends: backends.map((backend) => ({
          id: backend.id,
          reachable: args.net.isReachable(id, backend.id),
          requests: state.requestsByBackend.get(backend.id) ?? 0,
        })),
        recentRoutes: [...state.recentRoutes],
      };
    },
    onRoute(listener) {
      state.routeListeners.add(listener);
      return () => {
        state.routeListeners.delete(listener);
      };
    },
  };
}
