import api from '@apps/server-ts/server';
import type { ApiWorkerEnv } from '@libs/app-root-shared-ts/env';
import type {
  ExecutionContext,
  ExportedHandler,
} from '@libs/app-root-shared-ts/worker-handler';

export { RoomServerDurableObject } from '@apps/server-ts/room';
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
