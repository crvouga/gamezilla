/**
 * Local mirror of the gate jobs in
 * `.github/workflows/deployment-pipeline.yml`. Each `bunScript` is a
 * script in the repo root `package.json` and each `jobId` matches the
 * corresponding GitHub Actions job key so failure output (LLM fix
 * prompts, `write-pipeline-report.ts` tables) lines up with CI naming.
 *
 * Also the single source of truth for `bun run check`
 * (`tools/scripts/check.ts`; on failure writes `check/llm-fix-prompt.md`)
 * and `check:heal` steps.
 *
 * Turbo-cacheable work is split across `check-gates` / `check-verify` /
 * `check-build` (plus non-cacheable `check:secrets` on gates).
 * `check-static` covers actionlint + gitleaks, and the two remaining
 * `check-*` job ids match the per-job Hono integration / Playwright runs
 * (`check:api` / `check:browser`).
 */
export const DEPLOYMENT_PIPELINE_CHECK_STEPS = [
  { jobId: 'check-gates', bunScript: 'check:ci:gates' },
  { jobId: 'check-verify', bunScript: 'check:ci:verify' },
  { jobId: 'check-build', bunScript: 'check:ci:build' },
  { jobId: 'check-static', bunScript: 'check:static' },
  { jobId: 'check-api', bunScript: 'check:api' },
  { jobId: 'check-browser', bunScript: 'check:browser' },
] as const;

export type DeploymentPipelineCheckStep =
  (typeof DEPLOYMENT_PIPELINE_CHECK_STEPS)[number];
