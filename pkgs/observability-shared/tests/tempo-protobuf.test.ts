import { expect, test } from 'bun:test';
import { TempoTraceStore } from '@pkgs/observability-shared/tempo';

const TRACE_ID = '1b862c95558841b98a8e3648862b3b15';
// Literal response from the live Tempo trace endpoint.
const DOCUMENT = {
  batches: [
    {
      resource: {
        attributes: [{ key: 'service.name', value: { stringValue: 'client' } }],
      },
      scopeSpans: [
        {
          scope: {},
          spans: [
            {
              traceId: 'G4YslVWIQbmKjjZIhis7FQ==',
              spanId: '1KXeFwBkSl8=',
              name: 'client.error',
              startTimeUnixNano: '1790910060000000000',
              endTimeUnixNano: '1790910060001000000',
              attributes: [
                {
                  key: 'user.id',
                  value: {
                    stringValue: 'bb373824-4bd0-43b8-80c6-6319e5f001e0',
                  },
                },
              ],
              status: { message: 'app crashed', code: 'STATUS_CODE_ERROR' },
            },
          ],
        },
      ],
    },
  ],
};

// regression: tempo-protobuf-traces-discarded
test('reads the spans and canonical ids in a Tempo protobuf JSON response', async () => {
  const store = new TempoTraceStore({
    baseUrl: 'https://tempo.example.test',
    now: () => 1790910108421,
    fetch: async () => Response.json(DOCUMENT),
  });
  const trace = await store.getTrace(TRACE_ID);
  expect(trace?.spans).toHaveLength(1);
  expect(trace?.spans[0]).toMatchObject({
    traceId: TRACE_ID,
    spanId: 'd4a5de1700644a5f',
    status: 'error',
    startTimeMs: 1790910060000,
    durationMs: 1,
    attributes: {
      'service.name': 'client',
      'user.id': 'bb373824-4bd0-43b8-80c6-6319e5f001e0',
    },
  });
});
