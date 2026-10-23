import { expect, test } from 'bun:test';
import { HttpResponseScope } from '@pkgs/http-client-shared-ts/response-scope';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

test('a scope succeeds exactly when every body is consumed or canceled', async () => {
  await assertProperty(
    'HTTP body ownership',
    fc.asyncProperty(
      fc.array(fc.constantFrom('read', 'cancel', 'ignore', 'partial'), {
        maxLength: 12,
      }),
      async (actions) => {
        const scope = new HttpResponseScope({
          fetch: async () => new Response('payload'),
        });
        for (const action of actions) {
          const response = await scope.fetch(
            'https://collector.example/v1/traces'
          );
          if (action === 'read') await response.text();
          if (action === 'cancel') await response.body?.cancel();
          if (action === 'partial') {
            const reader = response.body!.getReader();
            await reader.read();
            reader.releaseLock();
          }
        }
        const leaked = actions.some(
          (action) => action === 'ignore' || action === 'partial'
        );
        if (leaked)
          await expect(scope.finish()).rejects.toThrow(
            'HTTP response body leak'
          );
        else await scope.finish();
      }
    )
  );
});
