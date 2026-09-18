/** Local mirror of the CI check surface — the single PR check in `.github/workflows/pr.yml`. */
export const DEPLOYMENT_PIPELINE_CHECK_STEPS = [
  { jobId: 'check:full', bunScript: 'check:full' },
] as const;
