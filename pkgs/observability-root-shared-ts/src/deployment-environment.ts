/**
 * The trace environment a runtime reports as `deployment.environment.name`:
 * a deployed environment's own name (`dev`, `prd`, `staging`, …), or `local`
 * / `ci` / `test` for runs that are not deployments. Which environments exist
 * is the deploy's decision, not this package's.
 */
export type TelemetryEnvironment = string;

/**
 * The trace environment of a deployed runtime. `deployment` is the name the
 * deploy stamps onto the runtime (absent in local runs, which report
 * `local`); several deployed environments may share one trace backend, so
 * their spans carry that name unchanged to say which one they came from.
 */
export function deploymentTelemetryEnvironment(
  deployment: string | undefined
): TelemetryEnvironment {
  const name = deployment?.trim() ?? '';
  return name.length > 0 ? name : 'local';
}

/**
 * What a browser reports before the server restates it. The telemetry ingress
 * replaces it with the deployment's own name, so a span that reaches the trace
 * store still carrying this one skipped the ingress.
 */
export const UNSTATED_ENVIRONMENT = 'unstated';

/** Spans a health check plants to prove the trail can be followed. Not activity. */
export const PROBE_ENVIRONMENT = 'health-probe';
