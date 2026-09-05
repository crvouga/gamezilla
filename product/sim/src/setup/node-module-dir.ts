/**
 * Node-only path helpers for sim seed / fixture layout.
 * Safe to evaluate in the browser: returns null when `__dirname` is absent.
 */

import { join } from 'node:path';

/** `typeof` is safe when `__dirname` is undeclared (browser ESM). */
export function nodeDirname(): string | null {
  return typeof __dirname !== 'undefined' ? __dirname : null;
}

export function joinFromModuleDir(
  ...segments: readonly string[]
): string | null {
  const dir = nodeDirname();
  if (dir === null) return null;
  return join(dir, ...segments);
}

export function requireNodeDirname(label: string): string {
  const dir = nodeDirname();
  if (dir === null) {
    throw new Error(
      `${label}: Node __dirname required (not available in browser)`
    );
  }
  return dir;
}
