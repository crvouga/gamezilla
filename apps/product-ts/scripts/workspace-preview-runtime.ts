// @io-wall-ok — read-only checkout tunnel address, safe in Vite's Node config.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export function previewOriginPath(dataDir: string): string {
  return join(dataDir, 'preview', 'origin.json');
}

export function quickPreviewOrigin(
  dataDir: string,
  workspaceKey: string
): string | null {
  const path = previewOriginPath(dataDir);
  if (!existsSync(path)) return null;
  const value: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (
    typeof value !== 'object' ||
    value === null ||
    !('workspaceKey' in value) ||
    value.workspaceKey !== workspaceKey ||
    !('origin' in value) ||
    typeof value.origin !== 'string' ||
    !/^https:\/\/[a-z0-9-]+\.trycloudflare\.com$/.test(value.origin)
  )
    throw new Error(
      'Invalid checkout tunnel address; stop and restart this worktree'
    );
  return value.origin;
}
