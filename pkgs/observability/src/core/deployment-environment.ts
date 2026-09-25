export type TelemetryEnvironment = 'local' | 'ci' | 'dev' | 'prod' | 'test';

/**
 * The trace environment of a deployed runtime. `deployment` is the name the
 * deploy stamps onto the runtime (absent in local runs); several deployed
 * environments may share one trace backend, so their spans must say which
 * one they came from.
 */
export function deploymentTelemetryEnvironment(
  deployment: string | undefined
): TelemetryEnvironment {
  const name = deployment?.trim() ?? '';
  if (name === 'prd') return 'prod';
  if (name === 'dev') return 'dev';
  return 'local';
}
