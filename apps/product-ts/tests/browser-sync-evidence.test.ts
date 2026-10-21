import { expect, test } from 'bun:test';
import {
  mqttPushEvidence,
  syncRequestEvidence,
  syncResponseEvidence,
} from '@apps/product-ts/browser-sync-evidence';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

function publishFrame(protocol: number, secret: string): string {
  const topic = Buffer.from('room:space');
  const message = Buffer.from(
    JSON.stringify({
      pushSeq: '4',
      checkpoint: '12',
      tables: ['games'],
      rows: { games: [{ id: secret, deleted_at: null }] },
      credential: secret,
    })
  );
  const body = Buffer.concat([
    Buffer.from([0, topic.length]),
    topic,
    Buffer.from([0, 1]),
    ...(protocol === 5 ? [Buffer.from([0])] : []),
    message,
  ]);
  let remaining = body.length;
  const length: number[] = [];
  do {
    const digit = remaining % 128;
    remaining = Math.floor(remaining / 128);
    length.push(digit | (remaining > 0 ? 128 : 0));
  } while (remaining > 0);
  return Buffer.concat([Buffer.from([0x32, ...length]), body]).toString(
    'base64'
  );
}

test('sync evidence preserves query order, verdicts and row counts without values', () => {
  expect(
    syncRequestEvidence(
      '/api/query',
      JSON.stringify({
        queries: [{ name: 'games', params: { private: 'private-args' } }],
      })
    )
  ).toEqual(['games']);
  const response = syncResponseEvidence(
    '/api/query',
    JSON.stringify({
      responses: [
        {
          status: 'ok',
          checkpoint: '12',
          tables: {
            games: [
              { id: 'private-id', deleted_at: null },
              { id: 'private-old', deleted_at: 1 },
            ],
          },
        },
      ],
    })
  );
  expect(response).toEqual([
    {
      status: 'ok',
      checkpoint: '12',
      tables: { games: { total: 2, live: 1 } },
    },
  ]);
  expect(JSON.stringify(response)).not.toContain('private-');
});

test('MQTT evidence keeps only received push metadata for both protocol versions', async () => {
  await assertProperty(
    'safe live push evidence',
    fc.property(fc.constantFrom(4, 5), fc.string(), (protocol, draw) => {
      const summary = mqttPushEvidence(
        publishFrame(protocol, `private-${draw}`),
        protocol
      );
      expect(summary).toEqual({
        topic: 'room:space',
        pushSeq: '4',
        checkpoint: '12',
        tables: ['games'],
        rows: { games: { total: 1, live: 1 } },
      });
      expect(JSON.stringify(summary)).not.toContain('private-');
    })
  );
  expect(
    mqttPushEvidence(Buffer.from([0x10, 0]).toString('base64'), 4)
  ).toBeUndefined();
});
