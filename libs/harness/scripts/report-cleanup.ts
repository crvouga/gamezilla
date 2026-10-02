#!/usr/bin/env bun
// @io-wall-ok — maintenance entry: injected reports store and GitHub CLI.
import {
  planReportRetention,
  pruneReports,
} from '@pkgs/harness-report/remote/retention';
import { capture } from '@pkgs/os';
import {
  type BranchCleanupPort,
  type CleanupBranch,
  type CleanupPull,
  cleanupBranches,
} from './branch-cleanup';
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
          'map({branch: .head.ref, sha: .head.sha, state: .state, merged: (.merged_at != null), repo: .head.repo.full_name})',
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
    async remove(branch) {
      const result = capture('gh', [
        'api',
        '--method',
        'DELETE',
        `${root}/git/refs/heads/${encodeURIComponent(branch)}`,
      ]);
      if (result.status !== 0)
        throw new Error(`Deleting branch ${branch} failed: ${result.stderr}`);
    },
  };
}

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  const repo =
    process.env['GITHUB_REPOSITORY'] ??
    gh<{ nameWithOwner: string }>(['repo', 'view', '--json', 'nameWithOwner'])
      .nameWithOwner;
  const github = githubPort(repo);
  if (process.argv.includes('--branches')) {
    console.log(
      `Branches ${apply ? 'deleted' : 'eligible'}: ${JSON.stringify(await cleanupBranches(github, apply))}`
    );
  }
  const branches = new Map(
    (await github.branches()).map((branch) => [branch.name, branch.sha])
  );
  if (branches.size === 0)
    throw new Error('Refusing report cleanup with an empty branch inventory');
  const store = reportsStore();
  const plan = apply
    ? await pruneReports(store, branches)
    : await planReportRetention(store, branches);
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
