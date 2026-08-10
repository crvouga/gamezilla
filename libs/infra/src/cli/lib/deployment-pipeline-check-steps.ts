/**
 * Local mirror of the gate jobs in
 * `.github/workflows/deployment-pipeline.yml`. Each `bunScript` is a
 * script in the repo root `package.json` and each `jobId` matches the
 * corresponding GitHub Actions job key so failure output (LLM fix
 * prompts, `write-pipeline-report.ts` tables) lines up with CI naming.
 *
 * Also the step list for `check:heal` (runs these scripts sequentially).
 * Local `bun run check` is one offline `turbo-ci-run` graph (gates/verify/
 * static + package-scoped app builds; not this parallel fan-out). Live
 * `check:api` stays CI / heal / opt-in only.
 *
 * Turbo-cacheable work is split across `check-gates` / `check-verify` /
 * `check-build` (gates include `check:secrets:validate`, cached on a
 * fingerprint of registry secret values in `dev` + `prd`).
 * `check-static` covers actionlint + gitleaks; `check-api` is the Hono
 * integration run against a live preview Worker.
 */
export const DEPLOYMENT_PIPELINE_CHECK_STEPS = [
  { jobId: 'check-gates', bunScript: 'check:ci:gates' },
  { jobId: 'check-verify', bunScript: 'check:ci:verify' },
  { jobId: 'check-build', bunScript: 'check:ci:build' },
  { jobId: 'check-static', bunScript: 'check:static' },
  { jobId: 'check-api', bunScript: 'check:api' },
] as const;

export type DeploymentPipelineCheckStep =
  (typeof DEPLOYMENT_PIPELINE_CHECK_STEPS)[number];
