import '@libs/app-root-server-ts/install-native-als';
import type { ApiWorkerEnv } from '@libs/app-root-shared-ts/env';
import type { ExportedHandler } from '@libs/app-root-shared-ts/worker-handler';
import { bootAdminApi, drainAdminOutbox } from './worker-boot';

let api: Awaited<ReturnType<typeof bootAdminApi>> | undefined;

export default {
  async scheduled(_controller, env) {
    await drainAdminOutbox(env);
  },
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path !== '/api' && !path.startsWith('/api/')) {
      if (!env.ASSETS)
        return new Response('Admin client unavailable', { status: 503 });
      return env.ASSETS.fetch(request);
    }
    api ??= await bootAdminApi(env);
    return api.fetch(request, env, ctx as Parameters<typeof api.fetch>[2]);
  },
} satisfies ExportedHandler<ApiWorkerEnv>;
