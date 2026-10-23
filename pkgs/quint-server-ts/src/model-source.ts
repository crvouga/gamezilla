// @io-wall-ok — fingerprints the complete deterministic input to the Quint CLI.
import { readFileSync } from 'node:fs';
import { basename, dirname, relative, resolve } from 'node:path';
import { quintImportPaths } from '@pkgs/quint-shared-ts/imports';

/** `space-hosting.qnt` → `space_hosting`, the module Quint runs. */
export function quintModuleName(specPath: string): string {
  return basename(specPath, '.qnt').replaceAll('-', '_');
}

export function modelSourceKey(specPath: string): string {
  const files = new Map<string, string>();
  const pending = [specPath];
  for (const path of pending) {
    if (files.has(path)) continue;
    const source = readFileSync(path, 'utf8');
    files.set(path, source);
    for (const from of quintImportPaths(source)) {
      const imported = resolve(dirname(path), from);
      pending.push(imported.endsWith('.qnt') ? imported : `${imported}.qnt`);
    }
  }
  const manifest = JSON.parse(
    readFileSync(
      Bun.resolveSync('@informalsystems/quint/package.json', import.meta.dir),
      'utf8'
    )
  ) as { version: string };
  return JSON.stringify({
    format: 2,
    quint: manifest.version,
    bun: Bun.version,
    files: [...files]
      .map(([path, source]) => [relative(dirname(specPath), path), source])
      .sort(([a], [b]) => (a! < b! ? -1 : a! > b! ? 1 : 0)),
  });
}
