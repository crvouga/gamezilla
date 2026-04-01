/**
 * Context flags passed to `cdk deploy` and preflight `cdk synth` so both target the same template.
 * Keep in sync when changing CI/local deploy behavior.
 */
export const CDK_DEPLOY_CONTEXT_ARGS = [
  '-c',
  'customDomain=true',
  '-c',
  'customDomainBootstrap=false',
] as const;
