// @io-wall-ok — build-tool composition root
import type { IncomingMessage, ServerResponse } from 'node:http';
import { fileURLToPath } from 'node:url';
import type { Plugin } from 'vite';

type DevReportModule = {
  readonly FEEDBACK_PATH: string;
  createDevReportDispatcher: (
    repoRoot: string
  ) => (request: IncomingMessage, response: ServerResponse) => Promise<void>;
};

/** Mounted before Vite/product middleware; no product server, secrets or DB involved. */
export function feedbackDevPlugin(options: {
  readonly repoRoot: string;
}): Plugin {
  return {
    name: 'root-feedback',
    apply: 'serve',
    async configureServer(server) {
      // Vite resolves workspace TypeScript; Node's config loader cannot.
      const backend = (await server.ssrLoadModule(
        fileURLToPath(new URL('./vite-handler.ts', import.meta.url))
      )) as DevReportModule;
      const dispatch = backend.createDevReportDispatcher(options.repoRoot);
      server.middlewares.use((request, response, next) => {
        if (
          !(
            request.url?.split('?')[0] === backend.FEEDBACK_PATH ||
            request.url?.startsWith(`${backend.FEEDBACK_PATH}/`)
          )
        ) {
          next();
          return;
        }
        void dispatch(request, response).catch(() => {
          if (response.writableEnded) return;
          response.statusCode = 503;
          response.end('Could not save report');
        });
      });
    },
  };
}
