import { expect, test } from 'bun:test';
import {
  aggregateMetricExporter,
  ROOM_SERVICE_NAME,
} from '@apps/product-api-ts/worker-telemetry';
import { SERVER_SERVICE_NAME } from '@libs/observability-shared-ts/service-names';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';

const METRICS_URL = 'https://metrics.example/v1/metrics';
const ports = createHarnessClock();

function binding() {
  const handed: {
    service: string;
    writer: string;
    sequence: number;
    increments: { name: string; value: number }[];
  }[] = [];
  return {
    handed,
    namespace: {
      idFromName: (name: string) => ({ name }),
      get: () => ({
        fetch: async (request: Request) => {
          handed.push((await request.json()) as (typeof handed)[number]);
          return Response.json({ status: 'added', refused: 0 });
        },
      }),
    },
  };
}

test('the API and the room server have distinct service names, so their totals stay apart', () => {
  expect(ROOM_SERVICE_NAME).not.toBe(SERVER_SERVICE_NAME);
});

test('without the aggregate binding or a metrics backend, an isolate has no hand-off exporter', () => {
  const { namespace } = binding();
  const writer = { id: 'isolate-1', service: SERVER_SERVICE_NAME };

  expect(
    aggregateMetricExporter(
      { OBSERVABILITY_METRICS_URL: METRICS_URL },
      writer,
      ports
    )
  ).toEqual({});
  expect(
    aggregateMetricExporter({ METRIC_AGGREGATE: namespace }, writer, ports)
  ).toEqual({});
  expect(
    aggregateMetricExporter(
      {
        METRIC_AGGREGATE: namespace,
        OBSERVABILITY_METRICS_URL: METRICS_URL,
        OBSERVABILITY_ENABLED: '0',
      },
      writer,
      ports
    )
  ).toEqual({});
});

test('with the binding, an isolate hands what it counted to the aggregate under its own service and id', async () => {
  const { namespace, handed } = binding();
  const { metricExporter } = aggregateMetricExporter(
    { METRIC_AGGREGATE: namespace, OBSERVABILITY_METRICS_URL: METRICS_URL },
    { id: 'isolate-1', service: ROOM_SERVICE_NAME },
    ports
  );
  if (metricExporter === undefined) throw new Error('No hand-off exporter');
  type Collected = Parameters<typeof metricExporter.export>[0];
  const metric = {
    descriptor: { name: 'requests_total', unit: '', description: '' },
    dataPointType: 3,
    isMonotonic: true,
    dataPoints: [{ attributes: {}, value: 2 }],
  };

  const outcome = await new Promise<{ code: number }>((resolve) =>
    metricExporter.export(
      {
        scopeMetrics: [{ scope: { name: 'fixture' }, metrics: [metric] }],
      } as unknown as Collected,
      resolve
    )
  );

  expect(outcome.code).toBe(0);
  expect(
    handed.map(({ service, writer, sequence, increments }) => ({
      service,
      writer,
      sequence,
      counted: increments.map((increment) => [increment.name, increment.value]),
    }))
  ).toEqual([
    {
      service: ROOM_SERVICE_NAME,
      writer: 'isolate-1',
      sequence: 1,
      counted: [['requests_total', 2]],
    },
  ]);
});
