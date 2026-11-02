import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  allowedPreviewEmail,
  previewMachineIdentity,
  type WorkspacePreviewScope,
  workspacePreviewKey,
} from '@apps/product-ts/scripts/workspace-preview-scope';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) removeTree(dir, { whenLocked: 'leave' });
});
const FIRST: WorkspacePreviewScope = {
  namespace: 'example',
  environment: 'dev',
  machineId: 'machine-a',
  worktreePath: '/home/developer/example/worktree-a',
};

// regression: workspace-preview-cross-worktree-routing
test('identical paths on different machines and different worktrees have independent identities', () => {
  const scopes = [
    FIRST,
    { ...FIRST, machineId: 'machine-b' },
    { ...FIRST, worktreePath: '/home/developer/example/worktree-b' },
    { ...FIRST, environment: 'staging' },
    { ...FIRST, namespace: 'another-project' },
  ];
  const keys = scopes.map(workspacePreviewKey);
  expect(workspacePreviewKey(FIRST)).toBe('p-7300586288aa24ad1ca269fb10dd6a08');
  expect(new Set(keys).size).toBe(scopes.length);
  expect(workspacePreviewKey({ ...FIRST })).toBe(workspacePreviewKey(FIRST));
  expect(keys.every((key) => /^p-[a-f0-9]{32}$/.test(key))).toBe(true);
});

// regression: workspace-preview-cross-worktree-routing
test('concurrent cold worktrees publish a complete machine identity once', () => {
  const dir = mkdtempSync(join(tmpdir(), 'preview-machine-'));
  dirs.push(dir);
  let concurrent = '';
  const selected = previewMachineIdentity(dir, () => {
    concurrent = previewMachineIdentity(
      dir,
      () => '22222222-2222-4222-8222-222222222222'
    );
    return '11111111-1111-4111-8111-111111111111';
  });
  expect(selected).toBe(concurrent);
  expect(readFileSync(join(dir, 'preview-machine-id'), 'utf8')).toBe(selected);
  expect(readdirSync(dir)).toEqual(['preview-machine-id']);
  expect(
    previewMachineIdentity(dir, () => {
      throw new Error('must not mint again');
    })
  ).toBe(selected);
  writeFileSync(join(dir, 'preview-machine-id'), 'incomplete');
  expect(() => previewMachineIdentity(dir, () => 'replacement')).toThrow(
    'Invalid preview machine identity'
  );
});

// regression: workspace-actions-minimal
test('Run uses the developer email and refuses an unprotected or undeliverable tunnel', () => {
  expect(allowedPreviewEmail(' Developer@Example.com ')).toEqual([
    'developer@example.com',
  ]);
  for (const email of ['', 'invalid', '123+developer@users.noreply.github.com'])
    expect(() => allowedPreviewEmail(email)).toThrow('git config user.email');
});
