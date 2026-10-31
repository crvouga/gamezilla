import type { ReleasePolicy } from '@libs/runtime-server-ts/environment-release';

const ROOT = `${import.meta.dir}/../../..`;

type Job = { readonly needs?: string | readonly string[] };

function needsCheck(needs: Job['needs']): boolean {
  if (needs === 'deploy-verify') return true;
  return Array.isArray(needs) && needs.includes('deploy-verify');
}

/** Facts read from the shipped preparation and release definitions. */
export async function readReleasePolicy(): Promise<ReleasePolicy> {
  const deployText = await Bun.file(
    `${ROOT}/.github/workflows/deploy.yml`
  ).text();
  const checkText = await Bun.file(
    `${ROOT}/.github/workflows/verify-pr.yml`
  ).text();
  const workspace = `${ROOT}/libs/tools-harness-ts/workspace`;
  const preparation = await Bun.file(`${workspace}/setup.sh`).text();
  const startup = await Bun.file(`${workspace}/run.sh`).text();
  const helpers = await Bun.file(`${workspace}/lib.sh`).text();
  const opening = await Bun.file(`${workspace}/prepare.sh`).text();
  const deploy = Bun.YAML.parse(deployText) as {
    concurrency: { 'cancel-in-progress': boolean };
    jobs: Record<string, Job>;
  };
  const check = Bun.YAML.parse(checkText) as {
    concurrency: { 'cancel-in-progress': string };
  };
  const replacement = check.concurrency['cancel-in-progress'];
  const reportsFailure =
    preparation.includes('workspace_quiet "mise install" workspace_system') &&
    helpers.includes('!!! $label failed (exit $status)');
  const opensIndependently =
    startup.includes('exec bun run --silent dev') &&
    !startup.includes('workspace_system') &&
    !startup.includes('/setup.sh"');
  const toldAt = opening.indexOf('!!! environment preparation is incomplete');
  const openAt = opening.indexOf('==> workspace may be opened');
  return {
    shipNeedsPassingCheck: needsCheck(deploy.jobs['deploy-fleet']?.needs),
    newerProposalReplacesCheck: replacement.includes(
      "github.event_name == 'pull_request'"
    ),
    releaseCheckIsNotReplaced:
      replacement.includes("github.event_name == 'pull_request'") &&
      !replacement.includes('workflow_call'),
    underwayIsNotCancelled: deploy.concurrency['cancel-in-progress'] === false,
    noUndoOfStartedRelease:
      deploy.concurrency['cancel-in-progress'] === false &&
      !Object.keys(deploy.jobs).some((name) => name.includes('rollback')),
    preparationFailureIsTold: reportsFailure && toldAt >= 0,
    preparationFailureStillOpens:
      opensIndependently && toldAt >= 0 && openAt > toldAt,
  };
}
