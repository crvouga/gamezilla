import api from '@apps/product-api-ts/server';
import type { ApiWorkerEnv } from '@libs/app-root-shared-ts/env';
import type {
  ExecutionContext,
  ExportedHandler,
} from '@libs/app-root-shared-ts/worker-handler';

export {
  MetricAggregateDurableObject,
  RoomServerDurableObject,
} from '@apps/product-api-ts/room';
export { RoomStorageArchive } from './room-storage-archive';

export type AppWorkerEnv = ApiWorkerEnv & {
  readonly ASSETS: { fetch(request: Request): Promise<Response> };
};

export default {
  fetch(
    request: Request,
    env: AppWorkerEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    const path = new URL(request.url).pathname;
    if (path === '/api' || path.startsWith('/api/')) {
      return api.fetch(request, env, ctx);
    }
    return env.ASSETS.fetch(request);
  },
  scheduled: api.scheduled,
} satisfies ExportedHandler<AppWorkerEnv>;
