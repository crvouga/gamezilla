import api from '@apps/server/worker';
import type { ApiWorkerEnv } from '@libs/server-app/config/env';
import type {
  ExecutionContext,
  ExportedHandler,
} from '@libs/server-app/config/worker-handler';

export { RoomServerDurableObject } from '@apps/server/room';
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
