import { expect, test } from 'bun:test';
import { sanitizeBrowserOtlp } from '@pkgs/observability-root-shared-ts/browser-otlp';

const identity = { serviceName: 'example-client', environment: 'test' };

// regression: otel-browser-integer-observation
test('OTLP integer observations survive numeric and protobuf JSON string encodings', () => {
  for (const intValue of [321, '321']) {
    const result = sanitizeBrowserOtlp(
      {
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  {
                    eventName: 'browser.performance.measured',
                    attributes: [
                      { key: 'web_vital.name', value: { stringValue: 'lcp' } },
                      { key: 'web_vital.value', value: { intValue } },
                      { key: 'web_vital.unit', value: { stringValue: 'ms' } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      },
      'logs',
      identity
    );
    expect(JSON.stringify(result)).toContain('"doubleValue":321');
  }
});

test('named Web Vital observations retain numeric values and discard private attribution', () => {
  const result = sanitizeBrowserOtlp(
    {
      resourceLogs: [
        {
          scopeLogs: [
            {
              logRecords: [
                {
                  eventName: 'browser.performance.measured',
                  timeUnixNano: '1000000000',
                  attributes: [
                    { key: 'web_vital.name', value: { stringValue: 'lcp' } },
                    { key: 'web_vital.value', value: { doubleValue: 321.5 } },
                    { key: 'web_vital.unit', value: { stringValue: 'ms' } },
                    {
                      key: 'user.id',
                      value: { stringValue: 'private-person' },
                    },
                    {
                      key: 'interaction.target',
                      value: { stringValue: 'private-input' },
                    },
                  ],
                },
              ],
            },
          ],
        },
      ],
    },
    'logs',
    identity
  );
  const serialized = JSON.stringify(result);
  expect(serialized).toContain('browser.performance.measured');
  expect(serialized).toContain('321.5');
  expect(serialized).not.toContain('private');
});

test('browser log ingestion strips business claims, credentials, arbitrary bodies and forged resources', () => {
  const input = {
    resourceLogs: [
      {
        resource: {
          attributes: [
            { key: 'service.name', value: { stringValue: 'example-server' } },
          ],
        },
        scopeLogs: [
          {
            scope: {
              attributes: [
                { key: 'secret', value: { stringValue: 'credential' } },
              ],
            },
            logRecords: [
              {
                eventName: 'membership.payment.reconciled',
                body: { stringValue: 'chat contents' },
                severityNumber: 17,
                traceId: '0123456789abcdef0123456789abcdef',
                spanId: '0123456789abcdef',
                timeUnixNano: '1000000000',
                attributes: [
                  { key: 'auth.token', value: { stringValue: 'credential' } },
                  {
                    key: 'app.log.message',
                    value: {
                      stringValue: 'Bearer credential person@example.com',
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
  const result = sanitizeBrowserOtlp(input, 'logs', identity);
  const serialized = JSON.stringify(result);
  expect(serialized).toContain('example-client');
  expect(serialized).toContain('0123456789abcdef0123456789abcdef');
  expect(serialized).toContain('Bearer [redacted] [email-redacted]');
  expect(serialized).not.toContain('example-server');
  expect(serialized).not.toContain('membership.payment');
  expect(serialized).not.toContain('chat contents');
  expect(serialized).not.toContain('credential');
});

test('Web Vital ingestion preserves actual histogram values while removing metric identifiers and unrelated instruments', () => {
  const input = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: 'web.vital.lcp',
                histogram: {
                  aggregationTemporality: 2,
                  dataPoints: [
                    {
                      timeUnixNano: '2000000000',
                      startTimeUnixNano: '1000000000',
                      count: '2',
                      sum: 500,
                      explicitBounds: [100, 500],
                      bucketCounts: ['0', '2', '0'],
                      attributes: [
                        { key: 'user.id', value: { stringValue: 'person-1' } },
                      ],
                    },
                  ],
                },
              },
              { name: 'fake.business.revenue', sum: { dataPoints: [] } },
            ],
          },
        ],
      },
    ],
  };
  const serialized = JSON.stringify(
    sanitizeBrowserOtlp(input, 'metrics', identity)
  );
  expect(serialized).toContain('web.vital.lcp');
  expect(serialized).toContain('500');
  expect(serialized).toContain('2000000000');
  expect(serialized).not.toContain('person-1');
  expect(serialized).not.toContain('fake.business');
});

test('malformed histograms and oversized scopes cannot enter the telemetry backend', () => {
  expect(sanitizeBrowserOtlp({}, 'metrics', identity)).toBeUndefined();
  expect(() =>
    sanitizeBrowserOtlp(
      {
        resourceMetrics: [
          {
            scopeMetrics: [
              {
                metrics: [
                  {
                    name: 'web.vital.lcp',
                    histogram: {
                      dataPoints: [
                        {
                          count: 1,
                          sum: 100,
                          explicitBounds: [],
                          bucketCounts: [0],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      },
      'metrics',
      identity
    )
  ).toThrow('Invalid metric histogram');
});
