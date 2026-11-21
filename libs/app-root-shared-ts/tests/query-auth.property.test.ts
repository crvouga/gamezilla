import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import { resolveWith } from './query-auth-fixture';

test('an authentication dependency failure never fabricates an expired session', async () => {
  await assertProperty(
    'query-auth-preserves-infrastructure-failure',
    fc.asyncProperty(fc.string(), async (message) => {
      const failure = new Error(message);
      await expect(
        resolveWith(async () => {
          throw failure;
        })
      ).rejects.toBe(failure);
    })
  );
});
