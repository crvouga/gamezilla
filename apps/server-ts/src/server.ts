// @io-wall-ok — platform entrypoint; bug reporting never imports product bootstrap

// The local listener opens its HTTP scope before loading the product lazily.
// Install native context here so that first scope supports concurrent requests.
import './install-native-als';

import type { ApiWorkerEnv } from '@libs/app-root-shared-ts/env';
import type {
  ExecutionContext,
  ExportedHandler,
  ScheduledController,
} from '@libs/app-root-shared-ts/worker-handler';
import { BUG_REPORT_PATH } from '@pkgs/feedback-server-ts/bug-report-http-app';
import {
  countedBugReportSend,
  handleRootBugReport,
} from './root-bug-report-boot';

export { RoomServerDurableObject } from './room';

export default {
  async fetch(
    request: Request,
    env: ApiWorkerEnv,
    ctx: ExecutionContext
  ): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === BUG_REPORT_PATH && request.method === 'POST')
      return countedBugReportSend(request, env, ctx);
    if (
      pathname === BUG_REPORT_PATH ||
      pathname.startsWith(`${BUG_REPORT_PATH}/`)
    )
      return handleRootBugReport(request, env);
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
