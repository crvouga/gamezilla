/**
 * The important CI workflows on `main`, as metrics: every Release, Health and
 * Verify Nightly run on `main` records one sample — 1 when it passed, 0 when
 * any of its jobs failed or was cancelled — so a red workflow raises a Grafana
 * alert (`CI_WORKFLOW_ALERTS`) next to the GitHub issue it files
 * (`libs/tools-harness-ts/scripts/ci-workflow-alert.ts`).
 *
 * The workflow names are a closed vocabulary (a metric label can never be an
 * open value).
 */

import { technicalName } from '@libs/product-identity-shared-ts/technical-names';
import type { MetricContract } from '@pkgs/observability-root-shared-ts/metric-contract';
import { otlpGaugeRequest } from '@pkgs/observability-root-shared-ts/otlp-gauge';

export const CI_WORKFLOWS = ['release', 'health', 'verify-nightly'] as const;

export type CiWorkflow = (typeof CI_WORKFLOWS)[number];

export function isCiWorkflow(value: string): value is CiWorkflow {
  return (CI_WORKFLOWS as readonly string[]).includes(value);
}

export const CI_WORKFLOW_DIMENSION = 'app.ci.workflow';

/** One sample per workflow run on `main`: 1 passed, 0 failed. */
export const CI_WORKFLOW_METRIC: MetricContract = {
  name: 'ci.workflow.result',
  description:
    'One sample per Release, Health or Verify Nightly run on main: 1 when every job passed, 0 when any failed or was cancelled',
  type: 'gauge',
  unit: '{result}',
  dimensions: { [CI_WORKFLOW_DIMENSION]: CI_WORKFLOWS },
  environmentScoped: true,
};

/** The `service.name` CI reports its workflow results as. */
export const CI_SERVICE_NAME = technicalName(['ci']);

/** The OTLP/JSON request that records one workflow run's result. */
export function ciWorkflowResultRequest(input: {
  readonly workflow: CiWorkflow;
  readonly passed: boolean;
  readonly environment: string;
  readonly atMs: number;
  /** The commit the run built. */
  readonly version: string;
}): unknown {
  return otlpGaugeRequest({
    contract: CI_WORKFLOW_METRIC,
    service: { name: CI_SERVICE_NAME, version: input.version },
    environment: input.environment,
    atMs: input.atMs,
    readings: [
      {
        attributes: { [CI_WORKFLOW_DIMENSION]: input.workflow },
        value: input.passed ? 1 : 0,
      },
    ],
  });
}
