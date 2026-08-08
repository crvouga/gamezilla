import { DEPLOYMENT_PIPELINE_CHECK_STEPS } from '../../../libs/infra/src/cli/lib/deployment-pipeline-check-steps';

export interface CheckHealStep {
  readonly stepId: string;
  readonly bunScript: string;
  readonly env?: Readonly<Record<string, string>>;
}

/**
 * Same logical steps as GHA deploy-gate jobs. Heal runs them sequentially
 * (including live `check:api` / `check:browser`). Local `bun check` covers
 * the offline Turbo graph only (gates/verify/static/secrets + build).
 */
export const CHECK_HEAL_STEPS: ReadonlyArray<CheckHealStep> =
  DEPLOYMENT_PIPELINE_CHECK_STEPS.map((step) => ({
    stepId: step.jobId,
    bunScript: step.bunScript,
    ...(step.bunScript.startsWith('check:ci:')
      ? {
          env: {
            TURBO_OUTPUT_LOGS: 'errors-only',
          },
        }
      : {}),
  }));
