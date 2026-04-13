import type { ApiHandlerConfig } from './api-types';
import { createApiApp } from './create-api-app';

export type { ApiHandlerConfig } from './api-types';

export function createApiHandler(
  config: ApiHandlerConfig
): (request: Request) => Promise<Response> {
  const app = createApiApp(config);
  return async (request: Request) => app.fetch(request);
}
