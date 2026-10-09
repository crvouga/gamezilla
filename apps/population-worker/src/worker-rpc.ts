import type { PopulationWorkerRPC } from '@libs/population-server/worker-routes';
import type { HttpFetch } from '@pkgs/http-client-shared/types';
import { hc, type InferRequestType, type InferResponseType } from 'hono/client';

export function createWorkerRpc(
  origin: string,
  token: string,
  fetch: HttpFetch
) {
  return hc<PopulationWorkerRPC>(
    `${origin.replace(/\/$/, '')}/api/population-worker`,
    { fetch, headers: { authorization: `Bearer ${token}` } }
  );
}
export type WorkerRpc = ReturnType<typeof createWorkerRpc>;
export type WorkerAssignment = NonNullable<
  InferResponseType<WorkerRpc['claim']['$post'], 200>['assignment']
>;
export type WorkerRenewal = InferResponseType<
  WorkerRpc['renew']['$post'],
  200
>['renewal'];
export type Ownership = InferRequestType<WorkerRpc['renew']['$post']>['json'];
export function ownership(assignment: WorkerAssignment): Ownership {
  return {
    userId: assignment.lease.userId,
    workerId: assignment.lease.workerId,
    generation: assignment.lease.generation,
  };
}
