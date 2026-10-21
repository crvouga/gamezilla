import { assertLogicalObjectKey } from '@pkgs/object-store-root-shared-ts/namespace-guard';

export type KeyParts = {
  readonly parentSegments: readonly string[];
  readonly fileBase: string;
};

/** Split a hierarchical logical key into directory segments + leaf name. */
export function splitKey(key: string, label: string): KeyParts {
  assertLogicalObjectKey(key);
  const segments = key.split('/');
  const fileBase = segments[segments.length - 1];
  if (fileBase === undefined || fileBase.length === 0) {
    throw new Error(`${label}: invalid key: ${key}`);
  }
  for (const seg of segments) {
    if (seg.length === 0) {
      throw new Error(`${label}: empty path segment in: ${key}`);
    }
  }
  return { parentSegments: segments.slice(0, -1), fileBase };
}

export function assertBaseDir(baseDir: string, label: string): void {
  if (baseDir.length === 0) {
    throw new Error(`${label}: baseDir must be non-empty`);
  }
  if (baseDir.includes('/') || baseDir.includes('..')) {
    throw new Error(`${label}: baseDir must be a single path segment`);
  }
}

export function sortKeys(
  keys: readonly string[],
  prefix: string
): readonly string[] {
  const filtered =
    prefix.length === 0 ? [...keys] : keys.filter((k) => k.startsWith(prefix));
  return filtered.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
}
