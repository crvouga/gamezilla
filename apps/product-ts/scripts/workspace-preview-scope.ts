// @io-wall-ok — preview enrollment host identity adapter.

import { spawnSync } from 'node:child_process';
import { createHash, randomUUID } from 'node:crypto';
import {
  linkSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { NAMESPACE } from '@libs/product-identity-shared-ts/product-identity';
import { z } from 'zod';

function code(error: unknown): string | undefined {
  return error instanceof Error &&
    'code' in error &&
    typeof error.code === 'string'
    ? error.code
    : undefined;
}

/** Atomic publication lets cold worktrees initialize concurrently on one host. */
export function previewMachineIdentity(
  configDir: string,
  createId: () => string
): string {
  const path = join(configDir, 'preview-machine-id');
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  try {
    return readIdentity(path);
  } catch (error) {
    if (code(error) !== 'ENOENT') throw error;
  }
  const candidate = createId();
  const temp = `${path}.${candidate}.tmp`;
  writeFileSync(temp, candidate, { flag: 'wx', mode: 0o600 });
  try {
    linkSync(temp, path);
  } catch (error) {
    if (code(error) !== 'EEXIST') throw error;
  } finally {
    rmSync(temp, { force: true });
  }
  return readIdentity(path);
}

function readIdentity(path: string): string {
  const value = readFileSync(path, 'utf8').trim();
  if (
    !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(
      value
    )
  )
    throw new Error(
      'Invalid preview machine identity; restore it instead of copying another host’s identity'
    );
  return value;
}

export function localWorkspacePreviewScope(
  repoRoot: string,
  environment: string
): WorkspacePreviewScope {
  return {
    namespace: NAMESPACE,
    environment,
    machineId: previewMachineIdentity(
      join(homedir(), '.config', NAMESPACE),
      randomUUID
    ),
    worktreePath: realpathSync(repoRoot),
  };
}

/** Scope is independent of branch names and ports, which can repeat or change. */
export type WorkspacePreviewScope = {
  readonly namespace: string;
  readonly environment: string;
  readonly machineId: string;
  /** The execution host's canonical, absolute checkout path. */
  readonly worktreePath: string;
};

export function workspacePreviewKey(scope: WorkspacePreviewScope): string {
  const parts = [
    scope.namespace,
    scope.environment,
    scope.machineId,
    scope.worktreePath,
  ];
  if (parts.some((part) => part.trim().length === 0 || part.includes('\0')))
    throw new Error(
      'Preview identity requires a namespace, environment, machine and canonical checkout path'
    );
  return `p-${createHash('sha256').update(parts.join('\0')).digest('hex').slice(0, 32)}`;
}

export function allowedPreviewEmail(value: string): readonly string[] {
  const email = value.trim().toLowerCase();
  if (!z.email().safeParse(email).success || email.includes('noreply'))
    throw new Error(
      'Set git config user.email to an address that can receive the preview PIN, then Run app again'
    );
  return [email];
}

export function previewDeveloperEmails(repoRoot: string): readonly string[] {
  const result = spawnSync('git', ['config', 'user.email'], {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  return allowedPreviewEmail(result.status === 0 ? result.stdout : '');
}
