import { expect, test } from 'bun:test';
import { sanitizeBrowserOtlp } from '@pkgs/observability-root-shared-ts/browser-otlp';

function payload(
  target: string,
  instance = '00000000-0000-4000-8000-000000000001'
) {
  return {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            { key: 'service.instance.id', value: { stringValue: instance } },
          ],
        },
        scopeMetrics: [
          {
            metrics: [
              {
                name: 'sync.work.target',
                sum: {
                  aggregationTemporality: 2,
                  dataPoints: [
                    {
                      timeUnixNano: '123',
                      startTimeUnixNano: '100',
                      asDouble: 1,
                      attributes: [
                        {
                          key: 'app.sync.target',
                          value: { stringValue: target },
                        },
                        {
                          key: 'app.sync.cohort',
                          value: { stringValue: 'foreground' },
                        },
                        {
                          key: 'app.outcome',
                          value: { stringValue: 'good' },
                        },
                        {
                          key: 'deployment.environment.name',
                          value: { stringValue: 'forged' },
                        },
                        { key: 'user.id', value: { stringValue: 'private' } },
                      ],
                    },
                  ],
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

test('client sync counters retain bounded labels and use the ingress environment', () => {
  const safe = JSON.stringify(
    sanitizeBrowserOtlp(payload('read-fast'), 'metrics', {
      serviceName: 'client',
      environment: 'dev',
    })
  );
  expect(safe).toContain('read-fast');
  expect(safe).toContain('dev');
  expect(safe).not.toContain('forged');
  expect(safe).not.toContain('private');
  expect(safe).not.toContain('user.id');
});

test('unknown target values cannot create unbounded series', () => {
  expect(() =>
    sanitizeBrowserOtlp(payload('user-123'), 'metrics', {
      serviceName: 'client',
      environment: 'dev',
    })
  ).toThrow('Invalid sync metric dimensions');
});

test('independent browser counter writers never collapse into one resource', () => {
  const ids = [
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000002',
  ];
  for (const id of ids)
    expect(
      JSON.stringify(
        sanitizeBrowserOtlp(payload('read-fast', id), 'metrics', {
          serviceName: 'client',
          environment: 'dev',
        })
      )
    ).toContain(id);
  expect(() =>
    sanitizeBrowserOtlp(payload('read-fast', 'person@example.com'), 'metrics', {
      serviceName: 'client',
      environment: 'dev',
    })
  ).toThrow('opaque per-page instance ID');
});

// regression: browser-sync-metrics-forge-server-cohort
for (const [target, cohort] of [
  ['read-fast', 'server'],
  ['database-fast', 'foreground'],
  ['delivery-tail', 'foreground'],
] as const) {
  test(`browser metrics cannot claim ${target} in ${cohort}`, () => {
    const forged = payload('read-fast');
    const metric = forged.resourceMetrics[0]!.scopeMetrics[0]!.metrics[0]!;
    metric.name = 'sync.work.target';
    metric.sum.dataPoints[0]!.attributes = [
      { key: 'app.sync.target', value: { stringValue: target } },
      { key: 'app.sync.cohort', value: { stringValue: cohort } },
      { key: 'app.outcome', value: { stringValue: 'good' } },
    ];
    expect(() =>
      sanitizeBrowserOtlp(forged, 'metrics', {
        serviceName: 'client',
        environment: 'dev',
      })
    ).toThrow('Browser metrics cannot claim server performance');
  });
}
