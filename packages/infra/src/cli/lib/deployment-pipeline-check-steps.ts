/**
 * Mirrors `.github/workflows/deployment-pipeline.yml` `deploy.needs` check
 * jobs (everything before `publish-playwright-report` / `deploy`). Each
 * `bunScript` is a script in the repo root `package.json`.
 *
 * Keep job ids identical to workflow job keys so local output matches CI
 * naming in LLM prompts and `write-pipeline-report.ts` tables.
 */
export const DEPLOYMENT_PIPELINE_CHECK_STEPS = [
  { jobId: 'format', bunScript: 'check:format' },
  { jobId: 'tc', bunScript: 'check:tc' },
  { jobId: 'lint', bunScript: 'check:lint' },
  { jobId: 'test', bunScript: 'check:test' },
  { jobId: 'build', bunScript: 'check:build' },
  { jobId: 'i18n', bunScript: 'i18n:check' },
  { jobId: 'syncpack', bunScript: 'check:syncpack-workspace' },
  { jobId: 'knip', bunScript: 'knip:ci' },
  { jobId: 'depcruise', bunScript: 'depcruise:ci' },
  { jobId: 'actionlint', bunScript: 'check:actionlint' },
  { jobId: 'gitleaks', bunScript: 'check:gitleaks' },
  { jobId: 'audit', bunScript: 'check:audit' },
  { jobId: 'qa-api', bunScript: 'qa:api' },
  { jobId: 'qa-browser', bunScript: 'qa:browser' },
] as const;

export type DeploymentPipelineCheckStep =
  (typeof DEPLOYMENT_PIPELINE_CHECK_STEPS)[number];
