#!/usr/bin/env bun
// @io-wall-ok — maintenance entry: injected reports store and GitHub CLI.
import {
  planReportRetention,
  pruneReports,
} from '@crvouga/atlas/reports/retention';
import { capture } from '@pkgs/os-server-ts/command';
import type {
  BranchCleanupPort,
  CleanupBranch,
  CleanupPull,
} from './branch-cleanup';
import { cleanupBranches } from './branch-cleanup';
import { reportsStore } from './report-store';

type GithubBranch = {
  name: string;
  commit: { sha: string };
  protected: boolean;
};

function gh<T>(args: readonly string[]): T {
  const result = capture('gh', args);
  if (result.status !== 0)
    throw new Error(`GitHub maintenance failed: ${result.stderr}`);
  return JSON.parse(result.stdout) as T;
}

function githubPort(repo: string): BranchCleanupPort {
  const root = `repos/${repo}`;
  return {
    async defaultBranch() {
      return gh<{ default_branch: string }>(['api', root]).default_branch;
    },
    async branches(): Promise<CleanupBranch[]> {
      return gh<GithubBranch[]>([
        'api',
        '--paginate',
        '--slurp',
        `${root}/branches?per_page=100`,
      ])
        .flat()
        .map((branch) => ({
          name: branch.name,
          sha: branch.commit.sha,
          protected: branch.protected,
        }));
    },
    async pulls(): Promise<CleanupPull[]> {
      const all: (CleanupPull & { repo: string })[] = [];
      for (let page = 1; ; page += 1) {
        const pulls = gh<(CleanupPull & { repo: string })[]>([
          'api',
          `${root}/pulls?state=all&per_page=100&page=${page}`,
          '--jq',
          'map({branch: .head.ref, sha: .head.sha, state: .state, merged: (.merged_at != null), baseBranch: .base.ref, mergeSha: .merge_commit_sha, repo: .head.repo.full_name})',
        ]);
        all.push(...pulls);
        if (pulls.length < 100) break;
      }
      return all.filter((pull) => pull.repo === repo);
    },
    async compare(base, head) {
      return gh<{ status: string }>([
        'api',
        `${root}/compare/${encodeURIComponent(base)}...${head}`,
      ]).status;
    },
    async head(branch) {
      return gh<{ object: { sha: string } }>([
        'api',
        `${root}/git/ref/heads/${encodeURIComponent(branch)}`,
      ]).object.sha;
    },
    async remove(branch, expectedSha) {
      // A lease makes deletion atomic: a concurrent push cannot lose work.
      const ref = `refs/heads/${branch}`;
      const result = capture('git', [
        '-c',
        'credential.helper=',
        '-c',
        'credential.helper=!gh auth git-credential',
        'push',
        `--force-with-lease=${ref}:${expectedSha}`,
        `https://github.com/${repo}.git`,
        `:${ref}`,
      ]);
      if (result.status !== 0)
        throw new Error(`Deleting branch ${branch} failed: ${result.stderr}`);
    },
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  if (process.argv.includes('--branches')) {
    const repo =
      process.env['GITHUB_REPOSITORY'] ??
      gh<{ nameWithOwner: string }>(['repo', 'view', '--json', 'nameWithOwner'])
        .nameWithOwner;
    console.log(
      `Branches ${apply ? 'deleted' : 'eligible'}: ${JSON.stringify(await cleanupBranches(githubPort(repo), apply))}`
    );
  }
  const store = reportsStore();
  const plan = apply
    ? await pruneReports(store)
    : await planReportRetention(store);
  console.log(
    JSON.stringify({
      apply,
      retained: plan.retained.map((report) => ({
        branch: report.branch,
        sha: report.sha,
      })),
      removedObjects: plan.deleteKeys.length,
    })
  );
}

if (import.meta.main) await main();
