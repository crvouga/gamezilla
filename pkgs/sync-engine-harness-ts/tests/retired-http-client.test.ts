import { expect, test } from 'bun:test';
import { HttpNetworkError } from '@pkgs/http-client-shared-ts/http-network-error';
import { exampleSystem } from '@pkgs/sync-engine-harness-ts/example-app-system';
import { createHarnessHttpClient } from '@pkgs/sync-engine-harness-ts/http-bridge';
import { SERVER_HTTP } from '@pkgs/sync-engine-harness-ts/traffic';

// regression: sync-harness-retired-http-accepts-new-requests
test.each(['query', 'mutation'] as const)(
  'a retired HTTP client refuses a new %s without waiting for its scheduler',
  async (kind) => {
    await using run = await exampleSystem.run({
      seed: 'pack-publication.trace-24',
      args: { clientCount: 0 },
    });
    const http = await run.read((s) =>
      createHarnessHttpClient({
        network: s.runtime.kernel.network,
        clientId: 'http:retired',
        serverId: SERVER_HTTP,
        createId: s.runtime.kernel.nextId,
        scheduler: s.runtime.kernel.scheduler,
      })
    );
    http.dispose();
    let settled = false;
    let failure: unknown;
    const request: Promise<unknown> =
      kind === 'query' ? http.postQueries([]) : http.postMutations([]);
    const done = request.then(
      () => {
        settled = true;
      },
      (error: unknown) => {
        failure = error;
        settled = true;
      }
    );
    try {
      await run.until(() => settled, { maxMs: 50 });
      await done;
      expect(failure).toBeInstanceOf(HttpNetworkError);
    } finally {
      http.dispose();
    }
  }
);
