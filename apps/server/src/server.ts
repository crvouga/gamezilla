// @io-wall-ok — platform entrypoint; feedback never imports product bootstrap

import type { ApiWorkerEnv } from '@libs/app-shared/env';
import type {
  ExecutionContext,
  ExportedHandler,
  ScheduledController,
} from '@libs/app-shared/worker-handler';
import { FEEDBACK_PATH } from '@pkgs/feedback-server/http-handler';
import { handleRootFeedbackReport } from './root-feedback-boot';

export { RoomServerDurableObject } from './room';

export default {
  async fetch(
    request: Request,
    env: ApiWorkerEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (
      new URL(request.url).pathname === FEEDBACK_PATH ||
      new URL(request.url).pathname.startsWith(`${FEEDBACK_PATH}/`)
    )
      return handleRootFeedbackReport(request, env);
    const product = await import('./product-server');
    return product.default.fetch(request, env, ctx);
  },
  async scheduled(
    controller: ScheduledController,
    env: ApiWorkerEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    const product = await import('./product-server');
    return product.default.scheduled(controller, env, ctx);
  },
} satisfies ExportedHandler<ApiWorkerEnv>;
