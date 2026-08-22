/** Local mirror of CI check surface — single `bun check` / `bun deploy` graph. */
export const DEPLOYMENT_PIPELINE_CHECK_STEPS = [
  { jobId: 'check', bunScript: 'check' },
] as const;
