/**
 * An OTLP/JSON `ExportMetricsServiceRequest` holding gauge readings taken
 * at one moment, for a process that records a result once and exits (a
 * scheduled check, a CLI) rather than running a meter provider. Each point
 * also carries `deployment.environment.name`, because the process's
 * resource ends with it. Pure: the caller sends it with its own transport.
 */

import { ATTR } from './attributes';
import type { MetricContract } from './metric-contract';

type OtlpAttribute = {
  readonly key: string;
  readonly value: { readonly stringValue: string };
};

function attribute(key: string, value: string): OtlpAttribute {
  return { key, value: { stringValue: value } };
}

export type GaugeReading = {
  readonly attributes: Readonly<Record<string, string>>;
  readonly value: number;
};

export function otlpGaugeRequest(input: {
  readonly contract: MetricContract;
  readonly service: { readonly name: string; readonly version: string };
  readonly environment: string;
  readonly atMs: number;
  readonly readings: readonly GaugeReading[];
}): unknown {
  if (input.contract.type !== 'gauge') {
    throw new Error(
      `${input.contract.name} is a ${input.contract.type}, not a gauge`
    );
  }
  const timeUnixNano = `${String(Math.trunc(input.atMs))}000000`;
  return {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            attribute(ATTR.SERVICE_NAME, input.service.name),
            attribute(ATTR.SERVICE_VERSION, input.service.version),
            attribute(ATTR.DEPLOYMENT_ENVIRONMENT_NAME, input.environment),
          ],
        },
        scopeMetrics: [
          {
            scope: { name: '@pkgs/observability' },
            metrics: [
              {
                name: input.contract.name,
                description: input.contract.description,
                unit: input.contract.unit,
                gauge: {
                  dataPoints: input.readings.map((reading) => ({
                    attributes: [
                      ...Object.entries(reading.attributes).map(([k, v]) =>
                        attribute(k, v)
                      ),
                      attribute(
                        ATTR.DEPLOYMENT_ENVIRONMENT_NAME,
                        input.environment
                      ),
                    ],
                    timeUnixNano,
                    asDouble: reading.value,
                  })),
                },
              },
            ],
          },
        ],
      },
    ],
  };
}
