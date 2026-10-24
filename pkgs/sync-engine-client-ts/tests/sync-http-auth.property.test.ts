import { expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { arbJsonValue } from '@pkgs/property-shared-ts/json';
import { SyncApiAuthError } from '@pkgs/sync-engine-client-ts/sync-http-client';
import { SYNC_PROTOCOL_VERSION } from '@pkgs/sync-engine-shared-ts/v2';
import fc from 'fast-check';
import { type HttpContractCase, httpContract } from './sync-http-auth-fixture';

const request: fc.Arbitrary<HttpContractCase> = fc.record({
  operation: fc.constantFrom('query', 'mutation'),
  payload: arbJsonValue(2),
  cached: fc.constantFrom('opaque', 'valid', 'expired', 'missing'),
  renewal: fc.constantFrom('changed', 'same', 'missing', 'failed'),
});
const upgradeRefusal = fc
  .record({ extra: arbJsonValue(2), message: fc.string({ maxLength: 24 }) })
  .map((fields) =>
    JSON.stringify({ error: 'auth', reason: 'upgrade_required', ...fields })
  );
const authRefusal = fc.oneof(
  fc
    .record({
      reason: fc.constantFrom('expired', 'revoked', 'unknown'),
      extra: arbJsonValue(2),
    })
    .map((fields) => JSON.stringify({ error: 'auth', ...fields })),
  fc.constantFrom('null', '{', '', 'false', '[]', '0', '"upgrade_required"')
);

function payloadPreserved(host: ReturnType<typeof httpContract>): void {
  for (const sent of host.requests) {
    expect(sent).toEqual({
      body: host.expectedBody,
      method: 'POST',
      path: host.expectedPath,
      protocol: String(SYNC_PROTOCOL_VERSION),
      device: 'device-1',
    });
  }
  expect(host.pendingTimers()).toBe(0);
}

test('protocol refusals cannot turn into accepted work or renew identity after the response', async () => {
  await assertProperty(
    'sync HTTP protocol refusal preserves identity and work',
    fc.asyncProperty(request, upgradeRefusal, async (input, refusal) => {
      const host = httpContract(input, [{ refusal }, 'accept']);
      const result: unknown = await host
        .send()
        .catch((error: unknown) => error);
      expect(result).toBeInstanceOf(SyncApiAuthError);
      expect(result).toMatchObject({ reason: 'upgrade_required' });
      expect(host.requests).toHaveLength(1);
      expect(host.accepted).toEqual([]);
      // An expired cached JWT may renew before the peer has refused its protocol.
      expect(host.refreshes.every((event) => event.afterRequests === 0)).toBe(
        true
      );
      expect(host.refreshes.length).toBeLessThanOrEqual(1);
      payloadPreserved(host);
    })
  );
});

test('session renewal preserves complete requests and reaches a bounded recovery or refusal', async () => {
  await assertProperty(
    'sync HTTP renewal preserves the original operation',
    fc.asyncProperty(
      request,
      authRefusal,
      fc.constantFrom('accept', 'expired', 'revoked', 'upgrade_required'),
      async (input, refusal, final) => {
        const last =
          final === 'accept'
            ? 'accept'
            : { refusal: JSON.stringify({ error: 'auth', reason: final }) };
        const host = httpContract(input, [{ refusal }, last]);
        const result: unknown = await host
          .send()
          .catch((error: unknown) => error);
        expect(host.requests).toHaveLength(2);
        expect(
          host.refreshes.filter((event) => event.afterRequests === 1)
        ).toEqual([{ afterRequests: 1, skipCache: true }]);
        expect(host.refreshes.length).toBeLessThanOrEqual(2);
        if (final === 'accept') {
          expect(result).toEqual(host.result);
          expect(host.accepted).toEqual([JSON.parse(host.expectedBody)]);
        } else {
          expect(result).toBeInstanceOf(SyncApiAuthError);
          expect(result).toMatchObject({ reason: final });
          expect(host.accepted).toEqual([]);
        }
        payloadPreserved(host);
      }
    )
  );
});
