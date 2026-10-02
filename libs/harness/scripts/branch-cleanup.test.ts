import { expect, test } from 'bun:test';
import { type BranchCleanupPort, cleanupBranches } from './branch-cleanup';

test('branch cleanup preserves open work, protected refs, changed heads and unknown unmerged work', async () => {
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
        { branch: 'open', sha: 'open', state: 'open', merged: false },
        { branch: 'merged', sha: 'merged', state: 'closed', merged: true },
        {
          branch: 'abandoned',
          sha: 'abandoned',
          state: 'closed',
          merged: false,
        },
        { branch: 'reused', sha: 'old', state: 'closed', merged: true },
      ];
    },
    async compare(_base, sha) {
      return ['integrated', 'moved'].includes(sha) ? 'behind' : 'diverged';
    },
    async head(name) {
      return name === 'moved' ? 'new-work' : name;
    },
    async remove(name) {
      removed.push(name);
    },
  };
  expect(await cleanupBranches(port, false)).toEqual([
    'merged',
    'abandoned',
    'integrated',
  ]);
  expect(removed).toEqual([]);
  await cleanupBranches(port, true);
  expect(removed).toEqual(['merged', 'abandoned', 'integrated']);
});
