/**
 * Local mirror of the gate jobs in
 * `.github/workflows/deployment-pipeline.yml`. Each `bunScript` is a
 * script in the repo root `package.json` and each `jobId` matches the
 * corresponding GitHub Actions job key so failure output (LLM fix
 * prompts, `write-pipeline-report.ts` tables) lines up with CI naming.
 *
 * Turbo-cacheable work is split across `turbo-gates` / `turbo-verify` /
 * `turbo-build` (plus non-cacheable `check:secrets` on gates). `static`
 * covers actionlint + gitleaks, and the two `qa-*` entries match the
 * per-job Playwright / Hono integration runs.
 */
export const DEPLOYMENT_PIPELINE_CHECK_STEPS = [
  { jobId: 'turbo-gates', bunScript: 'check:ci:gates' },
  { jobId: 'turbo-verify', bunScript: 'check:ci:verify' },
  { jobId: 'turbo-build', bunScript: 'check:ci:build' },
  { jobId: 'static', bunScript: 'check:static' },
  { jobId: 'qa-api', bunScript: 'qa:api' },
  { jobId: 'qa-browser', bunScript: 'qa:browser' },
] as const;

export type DeploymentPipelineCheckStep =
  (typeof DEPLOYMENT_PIPELINE_CHECK_STEPS)[number];
