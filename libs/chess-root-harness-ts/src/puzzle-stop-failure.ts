import { scenarioAction } from '@libs/harness-ts/actor-ui';
import type { MutationBatchRequest } from '@pkgs/sync-engine-shared-ts/v2';

/** The real API rejects an unavailable command; no business verdict is fabricated. */
export const failStoppingPuzzleLoading = scenarioAction({
  name: 'failStoppingPuzzleLoading',
  act: async (s, actor: string = 'alice') => {
    const requests = s.harness.loadBalancer.requests;
    requests.rewrite(actor, 'POST', '/api/mutations', async (request) => {
      requests.rewrite(actor, 'POST', '/api/mutations', null);
      const body = (await request.json()) as MutationBatchRequest;
      return new Request(request, {
        body: JSON.stringify({
          ...body,
          mutations: body.mutations.map((mutation) => ({
            ...mutation,
            name: 'unavailableStopCommand',
          })),
        }),
      });
    });
    requests.set(actor, 'POST', '/api/mutations', null);
  },
});
