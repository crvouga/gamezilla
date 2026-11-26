// @io-wall-ok — local listener and minute trigger for the administration Worker.
import { runHttpInvocation } from '@pkgs/http-client-shared-ts/run-http-invocation';
import { createScopedHttpClient } from '@pkgs/http-client-shared-ts/scoped-http-client';
import worker from '../src/worker';

const localHttp = createScopedHttpClient({ fetch: globalThis.fetch });
globalThis.fetch = Object.assign(localHttp.fetch, {
  preconnect: globalThis.fetch.preconnect,
});

const listener = Bun.serve({
  hostname: '127.0.0.1',
  port: Number(process.env['API_NODE_PORT']),
  fetch: (request) =>
    runHttpInvocation(localHttp, (waitUntil) =>
      worker.fetch(request, process.env, {
        waitUntil,
        passThroughOnException: () => undefined,
      })
    ),
});

const timer = setInterval(() => {
  void runHttpInvocation(localHttp, () =>
    worker.scheduled(
      { scheduledTime: Date.now(), cron: '* * * * *', noRetry: false },
      process.env
    )
  ).catch((error: unknown) =>
    console.error('Scheduled administration work failed', error)
  );
}, 60_000);

const stop = () => {
  clearInterval(timer);
  void listener.stop(true);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
