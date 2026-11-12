import { expect, test } from 'bun:test';
import type { BranchCleanupPort } from './branch-cleanup';
import { cleanupBranches } from './branch-cleanup';
import { branchComparison } from './branch-comparison';

// regression: git-cleanup-closed-unmerged
// regression: health-cleanup-unrelated-history
test('branch cleanup archives idle unmerged work before deleting it and keeps open, recent, protected and changed heads', async () => {
  const removed: string[] = [];
  const archived: string[] = [];
  const now = Date.parse('2026-11-12T00:00:00Z');
  const day = 24 * 60 * 60 * 1000;
  const names = [
    'main',
    'protected',
    'open',
    'merged',
    'abandoned',
    'reused',
    'integrated',
    'unknown',
    'orphan',
    'moved',
    'recent',
    'archive',
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
      if (sha === 'orphan')
        return branchComparison({
          status: 1,
          stdout: '',
          stderr:
            'gh: No common ancestor between main and 9cf78c38eafca8501bf779973a97d9b3e01501189. (HTTP 404)',
        });
      return ['integrated', 'moved', 'merge'].includes(sha)
        ? 'behind'
        : 'diverged';
    },
    async head(name) {
      return name === 'moved' ? 'new-work' : name;
    },
    async committedAt(sha) {
      return sha === 'recent' ? now - day : now - 10 * day;
    },
    async archive(name, sha) {
      expect(sha).toBe(name);
      expect(removed).not.toContain(name);
      archived.push(name);
    },
    async remove(name, expectedSha) {
      expect(expectedSha).toBe(name);
      removed.push(name);
    },
    now: () => now,
  };
  const preview = await cleanupBranches(port, false);
  const swept = [
    'merged',
    'abandoned',
    'reused',
    'integrated',
    'unknown',
    'orphan',
  ];
  expect(preview.eligible).toEqual(swept);
  expect(preview.removed).toEqual([]);
  expect(preview.retained).toEqual([
    { branch: 'main', reason: 'protected, default or archive branch' },
    { branch: 'protected', reason: 'protected, default or archive branch' },
    { branch: 'open', reason: 'open PR' },
    { branch: 'moved', reason: 'head advanced during inventory' },
    { branch: 'recent', reason: 'unmerged, no open PR, active within 3 days' },
    { branch: 'archive', reason: 'protected, default or archive branch' },
  ]);
  expect(removed).toEqual([]);
  expect(archived).toEqual([]);
  const applied = await cleanupBranches(port, true);
  expect(removed).toEqual(swept);
  expect(archived).toEqual(['abandoned', 'reused', 'unknown', 'orphan']);
  expect(applied.archived).toEqual(archived);
});
