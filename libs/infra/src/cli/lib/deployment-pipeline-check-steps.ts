/**
 * Local mirror of the gate jobs in
 * `.github/workflows/deployment-pipeline.yml`. Each `bunScript` is a
 * script in the repo root `package.json` and each `jobId` matches the
 * corresponding GitHub Actions job key so failure output (LLM fix
 * prompts, `write-pipeline-report.ts` tables) lines up with CI naming.
 *
 * Also the step list for `check:heal` (runs these scripts sequentially).
 * Local `bun run check` is a single Turbo graph via
 * `tools/scripts/run-check-turbo.ts` (gates/verify/static/secrets + build;
 * not this parallel fan-out). Live `check:api` / `check:browser` stay
 * CI / heal / opt-in only.
 *
 * Turbo-cacheable work is split across `check-gates` / `check-verify` /
 * `check-build` (gates include `check:secrets:validate`, cached on a
 * fingerprint of registry secret values in `dev` + `prd`).
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
