import { expect, test } from 'bun:test';
import {
  githubRepository,
  type HygieneBranch,
  retentionReason,
} from './git-hygiene-policy';

const merged: HygieneBranch = {
  name: 'feat/example',
  sha: 'head',
  worktree: null,
  remoteSha: null,
  mergeIncluded: true,
  integrated: false,
  pulls: [
    {
      state: 'MERGED',
      headRefOid: 'head',
      baseRefName: 'main',
      mergeCommit: { oid: 'merge' },
    },
  ],
};

test('a squash merge is eligible only at its original head with its merge on main', () => {
  expect(retentionReason(merged)).toBeNull();
  expect(retentionReason({ ...merged, sha: 'new-work' })).not.toBeNull();
  expect(retentionReason({ ...merged, mergeIncluded: false })).not.toBeNull();
});

test('active worktrees, divergent remotes and missing PR evidence retain the branch', () => {
  expect(retentionReason({ ...merged, worktree: '/active' })).not.toBeNull();
  expect(
    retentionReason({ ...merged, remoteSha: 'remote-work' })
  ).not.toBeNull();
  expect(retentionReason({ ...merged, pulls: [] })).not.toBeNull();
  expect(retentionReason({ ...merged, name: 'main' })).not.toBeNull();
});

test('a head already on main is deleted even without pull metadata', () => {
  expect(retentionReason({ ...merged, pulls: [], integrated: true })).toBeNull();
});

test('archive is kept and a closed PR keeps work main does not contain', () => {
  expect(retentionReason({ ...merged, name: 'archive' })).not.toBeNull();
  expect(
    retentionReason({
      ...merged,
      pulls: [
        {
          state: 'CLOSED',
          headRefOid: 'head',
          baseRefName: 'main',
          mergeCommit: null,
        },
      ],
    })
  ).not.toBeNull();
});

test('an open or closed unmerged PR prevents cleanup even with an older merged PR', () => {
  for (const state of ['OPEN', 'CLOSED']) {
    expect(
      retentionReason({
        ...merged,
        pulls: [
          ...merged.pulls,
          { state, headRefOid: 'head', baseRefName: 'main', mergeCommit: null },
        ],
      })
    ).not.toBeNull();
  }
});

// regression: git-hygiene-branded-fixture
test('repository identity comes from origin without requiring Windows Git discovery', () => {
  for (const remote of [
    'https://github.com/example/widget.git',
    'git@github.com:example/widget.git',
    'ssh://git@github.com/example/widget',
  ])
    expect(githubRepository(remote)).toBe('example/widget');
  expect(() =>
    githubRepository('https://example.com/example/widget')
  ).toThrow();
  expect(() =>
    githubRepository('https://github.com/example/widget/extra')
  ).toThrow();
});
