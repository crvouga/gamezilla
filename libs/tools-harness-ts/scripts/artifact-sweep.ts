#!/usr/bin/env bun
// @io-wall-ok — maintenance entry: lists and deletes the repository's GitHub Actions artifacts.
/**
 * Keep GitHub Actions artifact storage far below the account's quota.
 *
 * Every Verify job hands its plan to the next through an artifact, so a full
 * quota stops all CI ("Artifact storage quota has been hit") until GitHub
 * recalculates usage, 6–12 hours after anything is deleted. Retention alone
 * did not prevent it: nightly runs upload one artifact per shard, and
 * artifacts of retired workflows keep their old retention.
 *
 * Health's hourly `health:cleanup` runs this sweep:
 * - an artifact older than `maxAgeDays` is deleted, whatever its retention;
 * - if what is left still exceeds `budgetBytes`, the oldest go first until
 *   it fits;
 * - an artifact of a run that has not finished is never deleted, because
 *   that run may still download it.
 *
 * `bun run libs/tools-harness-ts/scripts/artifact-sweep.ts` prints the plan;
 * `--apply` deletes.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { capture } from '@pkgs/os-server-ts/command';

export type StoredArtifact = {
  readonly id: number;
  readonly name: string;
  readonly sizeInBytes: number;
  /** ISO 8601, as GitHub reports it. */
  readonly createdAt: string;
  readonly expired: boolean;
  /** The run that uploaded it, when GitHub still knows it. */
  readonly runId: number | null;
};

export type SweepPolicy = {
  readonly maxAgeDays: number;
  readonly budgetBytes: number;
};

/** One week of diagnostics, and a budget far under the quota. */
export const SWEEP_POLICY: SweepPolicy = {
  maxAgeDays: 7,
  budgetBytes: 2 * 1024 ** 3,
};

export type SweepPlan = {
  readonly delete: readonly StoredArtifact[];
  /** Live bytes left once the plan is applied. */
  readonly keptBytes: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export function planArtifactSweep(input: {
  readonly artifacts: readonly StoredArtifact[];
  readonly now: Date;
  readonly activeRunIds: ReadonlySet<number>;
  readonly policy?: SweepPolicy;
}): SweepPlan {
  const policy = input.policy ?? SWEEP_POLICY;
  const live = input.artifacts.filter((artifact) => !artifact.expired);
  const deletable = (artifact: StoredArtifact) =>
    artifact.runId === null || !input.activeRunIds.has(artifact.runId);
  const age = (artifact: StoredArtifact) =>
    input.now.getTime() - Date.parse(artifact.createdAt);
  const doomed = new Set(
    live.filter(
      (artifact) =>
        deletable(artifact) && age(artifact) > policy.maxAgeDays * DAY_MS
    )
  );
  let keptBytes = live
    .filter((artifact) => !doomed.has(artifact))
    .reduce((sum, artifact) => sum + artifact.sizeInBytes, 0);
  const oldestFirst = live
    .filter((artifact) => !doomed.has(artifact) && deletable(artifact))
    .sort((a, b) => age(b) - age(a) || a.id - b.id);
  for (const artifact of oldestFirst) {
    if (keptBytes <= policy.budgetBytes) break;
    doomed.add(artifact);
    keptBytes -= artifact.sizeInBytes;
  }
  return {
    delete: live.filter((artifact) => doomed.has(artifact)),
    keptBytes,
  };
}

type GithubArtifact = {
  id: number;
  name: string;
  size_in_bytes: number;
  created_at: string;
  expired: boolean;
  workflow_run?: { id?: number | null } | null;
};

/** Run statuses GitHub reports for a run that has not finished. */
const UNFINISHED = ['in_progress', 'queued', 'waiting', 'requested', 'pending'];

/** Listings run to megabytes: thousands of artifacts before a sweep. */
function gh<T>(args: readonly string[]): T {
  const result = spawnSync('gh', [...args], {
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0)
    throw new Error(`GitHub artifact sweep failed: ${result.stderr}`);
  return JSON.parse(result.stdout) as T;
}

function repository(): string {
  const config = JSON.parse(
    readFileSync(
      join(
        import.meta.dirname,
        '../../infra-shared-ts/tofu/global.tfvars.json'
      ),
      'utf8'
    )
  ) as { github: { owner: string; repo: string } };
  return `${config.github.owner}/${config.github.repo}`;
}

function listArtifacts(repo: string): StoredArtifact[] {
  const pages = gh<{ artifacts: GithubArtifact[] }[]>([
    'api',
    '--paginate',
    '--slurp',
    `repos/${repo}/actions/artifacts?per_page=100`,
  ]);
  return pages
    .flatMap((page) => page.artifacts)
    .map((artifact) => ({
      id: artifact.id,
      name: artifact.name,
      sizeInBytes: artifact.size_in_bytes,
      createdAt: artifact.created_at,
      expired: artifact.expired,
      runId: artifact.workflow_run?.id ?? null,
    }));
}

function activeRunIds(repo: string): Set<number> {
  const ids = new Set<number>();
  for (const status of UNFINISHED) {
    const pages = gh<{ workflow_runs: { id: number }[] }[]>([
      'api',
      '--paginate',
      '--slurp',
      `repos/${repo}/actions/runs?status=${status}&per_page=100`,
    ]);
    for (const run of pages.flatMap((page) => page.workflow_runs))
      ids.add(run.id);
  }
  return ids;
}

const gib = (bytes: number) => `${(bytes / 1024 ** 3).toFixed(2)} GiB`;

function main(apply: boolean): void {
  const repo = repository();
  const artifacts = listArtifacts(repo);
  const plan = planArtifactSweep({
    artifacts,
    now: new Date(),
    activeRunIds: activeRunIds(repo),
  });
  const freed = plan.delete.reduce((sum, a) => sum + a.sizeInBytes, 0);
  console.log(
    `artifact-sweep: ${String(plan.delete.length)} of ${String(artifacts.length)} artifacts to delete (${gib(freed)}); ${gib(plan.keptBytes)} kept, budget ${gib(SWEEP_POLICY.budgetBytes)}`
  );
  if (!apply) {
    for (const artifact of plan.delete)
      console.log(`  would delete ${artifact.name} (${artifact.createdAt})`);
    return;
  }
  let failed = 0;
  for (const artifact of plan.delete) {
    const result = capture('gh', [
      'api',
      '-X',
      'DELETE',
      `repos/${repo}/actions/artifacts/${String(artifact.id)}`,
    ]);
    // Gone already (expired or deleted by its own run) is the goal reached.
    if (result.status !== 0 && !result.stderr.includes('404')) failed += 1;
  }
  if (failed > 0) {
    console.error(`artifact-sweep: ${String(failed)} deletions failed`);
    process.exit(1);
  }
}

if (import.meta.main) main(process.argv.includes('--apply'));
