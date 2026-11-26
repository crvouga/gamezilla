import type {
  PreparationPolicy,
  ReleasePolicy,
} from '@libs/runtime-server-ts/environment-release';

const ROOT = `${import.meta.dir}/../../..`;

export async function readPreparationPolicy(): Promise<PreparationPolicy> {
  const workspace = `${ROOT}/libs/tools-harness-ts/workspace`;
  const preparation = await Bun.file(`${workspace}/setup.sh`).text();
  const opening = await Bun.file(`${workspace}/prepare.sh`).text();
  const reportsFailure =
    preparation.includes('if ! workspace_system; then') &&
    preparation.includes('!!! mise install failed');
  // Opening a workspace is prepare.sh's contract. Run may repair dependencies
  // later without making a failed preparation close the editor environment.
  const openingHandlesFailure =
    opening.includes('if ! "') &&
    opening.includes('/setup.sh"; then') &&
    !/\bexit\s+[1-9]/.test(opening);
  const toldAt = opening.indexOf('!!! environment preparation is incomplete');
  const openAt = opening.indexOf('==> workspace may be opened');
  return {
    preparationFailureIsTold: reportsFailure && toldAt >= 0,
    preparationFailureStillOpens:
      openingHandlesFailure && toldAt >= 0 && openAt > toldAt,
  };
}

type Concurrency =
  | string
  | { readonly 'cancel-in-progress'?: boolean | string };
type Job = {
  readonly needs?: string | readonly string[];
  readonly uses?: string;
  readonly concurrency?: Concurrency;
};
type Workflow = {
  readonly on: Record<string, unknown>;
  readonly jobs: Record<string, Job>;
  readonly concurrency?: Concurrency;
};

function keepsActiveRun(owner: {
  readonly concurrency?: Concurrency;
}): boolean {
  const setting = owner.concurrency;
  return (
    typeof setting !== 'object' ||
    (setting['cancel-in-progress'] ?? false) === false
  );
}

function needsCheck(needs: Job['needs']): boolean {
  if (needs === 'deploy-verify') return true;
  return Array.isArray(needs) && needs.includes('deploy-verify');
}

async function workflow(file: string): Promise<Workflow> {
  return Bun.YAML.parse(
    await Bun.file(`${ROOT}/.github/workflows/${file}`).text()
  ) as Workflow;
}

export async function readReleasePolicy(): Promise<ReleasePolicy> {
  const [deploy, check, verifier] = await Promise.all([
    workflow('deploy.yml'),
    workflow('verify-pr.yml'),
    workflow('verify-full.yml'),
  ]);
  const releaseCheck = deploy.jobs['deploy-verify'];
  const activeReleaseIsProtected =
    typeof deploy.concurrency === 'object' &&
    deploy.concurrency['cancel-in-progress'] === false;
  return {
    shipNeedsPassingCheck: needsCheck(deploy.jobs['deploy-fleet']?.needs),
    newerProposalReplacesCheck:
      Object.hasOwn(check.on, 'pull_request') &&
      typeof check.concurrency === 'object' &&
      check.concurrency['cancel-in-progress'] === true,
    releaseCheckIsNotReplaced:
      activeReleaseIsProtected &&
      releaseCheck?.uses === './.github/workflows/verify-full.yml' &&
      keepsActiveRun(releaseCheck) &&
      Object.hasOwn(verifier.on, 'workflow_call') &&
      keepsActiveRun(verifier) &&
      Object.values(verifier.jobs).every(keepsActiveRun),
    underwayIsNotCancelled: activeReleaseIsProtected,
    noUndoOfStartedRelease:
      activeReleaseIsProtected &&
      !Object.keys(deploy.jobs).some((name) => name.includes('rollback')),
  };
}
