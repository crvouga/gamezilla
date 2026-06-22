/**
 * Local mirror of the gate jobs in
 * `.github/workflows/deployment-pipeline.yml`. Each `bunScript` is a
 * script in the repo root `package.json` and each `jobId` matches the
 * corresponding GitHub Actions job key so failure output (LLM fix
 * prompts, `write-pipeline-report.ts` tables) lines up with CI naming.
 *
 * The CI pipeline collapses every Turbo-cacheable task (format,
 * syncpack/catalog, knip, depcruise, circular-deps, audit, i18n, tc,
 * lint, test, build) into one `turbo-ci` job; the local mirror runs the
 * same `bun run check:ci` command so a failure in any underlying Turbo
 * task is captured. `static` covers actionlint + gitleaks, and the two
 * `qa-*` entries match the per-job Playwright / Hono integration runs.
 */
export const DEPLOYMENT_PIPELINE_CHECK_STEPS = [
  { jobId: 'turbo-ci', bunScript: 'check:ci' },
  { jobId: 'static', bunScript: 'check:static' },
  { jobId: 'qa-api', bunScript: 'qa:api' },
  { jobId: 'qa-browser', bunScript: 'qa:browser' },
  {
    jobId: 'qa-native',
    bunScript: 'qa:production-client',
  },
] as const;

export type DeploymentPipelineCheckStep =
  (typeof DEPLOYMENT_PIPELINE_CHECK_STEPS)[number];
