// @io-wall-ok — platform entrypoint; bug reporting never imports product bootstrap
import type { ApiWorkerEnv } from '@libs/server-app/config/env';
import { BUG_REPORT_PATH } from '@pkgs/bug-report/server';
import { handleRootBugReport } from './root-bug-reporting-boot';

export default {
  async fetch(
    request: Request,
    env: ApiWorkerEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    if (new URL(request.url).pathname === BUG_REPORT_PATH)
      return handleRootBugReport(request, env);
    const product = await import('./product/server');
    return product.default.fetch(request, env, ctx);
  },
  async scheduled(
    controller: ScheduledController,
    env: ApiWorkerEnv,
    ctx: ExecutionContext
  ): Promise<void> {
    const product = await import('./product/server');
    return product.default.scheduled(controller, env, ctx);
  },
} satisfies ExportedHandler<ApiWorkerEnv>;
