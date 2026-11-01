import { expect, test } from 'bun:test';
import type { BranchCleanupPort } from './branch-cleanup';
import { cleanupBranches } from './branch-cleanup';

// regression: git-cleanup-closed-unmerged
test('branch cleanup preserves closed unmerged work, open work, protected refs and changed heads', async () => {
  const removed: string[] = [];
  const names = [
    'main',
    'protected',
    'open',
    'merged',
    'abandoned',
    'reused',
    'integrated',
    'unknown',
    'moved',
  ];
  const port: BranchCleanupPort = {
    async branches() {
      return names.map((name) => ({
        name,
        sha: name,
        protected: name === 'protected',
      }));
    },
    async defaultBranch() {
      return 'main';
    },
    async pulls() {
      return [
        {
          baseBranch: 'main',
          mergeSha: null,
          branch: 'open',
          sha: 'open',
          state: 'open',
          merged: false,
        },
        {
          baseBranch: 'main',
          mergeSha: 'merge',
          branch: 'merged',
          sha: 'merged',
          state: 'closed',
          merged: true,
        },
        {
          baseBranch: 'main',
          mergeSha: null,
          branch: 'abandoned',
          sha: 'abandoned',
          state: 'closed',
          merged: false,
        },
        {
          baseBranch: 'main',
          mergeSha: 'merge',
          branch: 'reused',
          sha: 'old',
          state: 'closed',
          merged: true,
        },
      ];
    },
    async compare(_base, sha) {
      return ['integrated', 'moved', 'merge'].includes(sha)
        ? 'behind'
        : 'diverged';
    },
    async head(name) {
      return name === 'moved' ? 'new-work' : name;
    },
    async remove(name, expectedSha) {
      expect(expectedSha).toBe(name);
      removed.push(name);
    },
  };
  const preview = await cleanupBranches(port, false);
  expect(preview.eligible).toEqual(['merged', 'integrated']);
  expect(preview.removed).toEqual([]);
  expect(preview.retained).toContainEqual({
    branch: 'abandoned',
    reason: 'closed unmerged PR; explicit abandonment required',
  });
  expect(removed).toEqual([]);
  await cleanupBranches(port, true);
  expect(removed).toEqual(['merged', 'integrated']);
});
