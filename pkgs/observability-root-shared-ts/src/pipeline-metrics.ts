import { ATTR } from './attributes';
import type { MetricContract } from './metric-contract';

/** The scheduled server beat that proves telemetry still reaches the backend. */
export const PIPELINE_HEARTBEAT_METRIC = {
  name: 'telemetry.pipeline.heartbeat',
  description: 'Scheduled server telemetry heartbeat',
  type: 'counter',
  unit: '{beat}',
} as const;

/** One beat is stamped with the environment that emitted it. */
export function pipelineHeartbeatContract(environment: string): MetricContract {
  return {
    ...PIPELINE_HEARTBEAT_METRIC,
    dimensions: { [ATTR.DEPLOYMENT_ENVIRONMENT_NAME]: [environment] },
  };
}

export const EXPORT_ATTEMPT_OUTCOMES = ['success', 'failure'] as const;

export const EXPORT_ATTEMPTS_METRIC: MetricContract = {
  name: 'telemetry.business_event.export_attempts',
  description:
    'Physical acknowledged business event export attempts, never a logical business count',
  unit: '{attempt}',
  type: 'counter',
  dimensions: { 'telemetry.outcome': EXPORT_ATTEMPT_OUTCOMES },
};

/** Log records the schema guard refused to export. */
export const SCHEMA_VIOLATIONS_METRIC: MetricContract = {
  name: 'telemetry.logs.schema_violations',
  description: 'Log records rejected by the schema guard',
  unit: '{record}',
  type: 'counter',
  dimensions: {},
};
