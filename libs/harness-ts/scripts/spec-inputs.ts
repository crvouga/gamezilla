// @io-wall-ok — fingerprints the complete inputs of each independently cached spec part.
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { renameReplacing } from '@pkgs/fs-server-ts/rename-replacing';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import { quintImportPaths } from '@pkgs/quint-shared-ts/imports';
import { packageSpecUnits } from './replay-plans';
import { partsOf, type SpecUnit } from './spec-parts';
import { packageSpecs, type SpecManifest } from './spec-sources';

/** Imported models participate even when they live outside the owning domain. */
export function specSourceClosure(path: string): Record<string, string> {
  const files: Record<string, string> = {};
  const pending = [path];
  for (const next of pending) {
    if (Object.hasOwn(files, next)) continue;
    const source = readFileSync(next, 'utf8');
    files[next] = createHash('sha256').update(source).digest('hex');
    if (!next.endsWith('.qnt')) continue;
    for (const from of quintImportPaths(source)) {
      const imported = resolve(dirname(next), from);
      pending.push(imported.endsWith('.qnt') ? imported : `${imported}.qnt`);
    }
  }
  return files;
}

export function specInputManifest(
  units: readonly SpecUnit[],
  root: string
): string {
  const files = new Map<string, string>();
  for (const unit of units)
    for (const [path, hash] of Object.entries(specSourceClosure(unit.path)))
      files.set(slashPath(relative(root, path)), hash);
  return JSON.stringify({
    units: units.map((unit) => ({
      path: slashPath(relative(root, unit.path)),
      slice: unit.slice,
      variants: unit.variants,
    })),
    files: Object.fromEntries(
      [...files].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    ),
  });
}

/** Regenerated before planning and execution; never a stale committed file. */
export function writeSpecInputs(root: string): void {
  for (const tier of ['apps', 'libs', 'pkgs']) {
    for (const entry of readdirSync(join(root, tier), {
      withFileTypes: true,
    })) {
      const dir = join(root, tier, entry.name);
      if (!entry.isDirectory() || !existsSync(join(dir, 'package.json')))
        continue;
      writePackageInputs(dir, root);
    }
  }
}

function writePackageInputs(dir: string, root: string): void {
  const values = packageInputValues(dir, root);
  const inputs = join(dir, '.cache/spec-inputs');
  if (Object.keys(values).length === 0) return;
  mkdirSync(inputs, { recursive: true });
  for (const [file, value] of Object.entries(values))
    writeChanged(join(inputs, file), value);
}

/** A stale or absent fingerprint must never establish a complete Verify verdict. */
export function specInputProblems(dir: string, root: string): string[] {
  return Object.entries(packageInputValues(dir, root)).flatMap(
    ([file, value]) => {
      const path = join(dir, '.cache/spec-inputs', file);
      return existsSync(path) && readFileSync(path, 'utf8') === value
        ? []
        : [
            `${slashPath(relative(root, path))} is missing or stale; run bun spec:inputs`,
          ];
    }
  );
}

function packageInputValues(dir: string, root: string): Record<string, string> {
  const manifest = JSON.parse(
    readFileSync(join(dir, 'package.json'), 'utf8')
  ) as SpecManifest;
  const count: number | undefined = manifest.specParts;
  if (!count) return {};
  const paths = packageSpecs(dir, root);
  const units = packageSpecUnits(dir, paths, count);
  const parts = partsOf(units, count);
  const values: Record<string, string> = {};
  for (let index = 0; index < count; index++)
    values[`part-${index}.json`] = specInputManifest(parts[index]!, root);
  values['models.json'] = specInputManifest(
    units.filter(
      (unit) => unit.path.endsWith('.qnt') && (unit.slice?.index ?? 0) === 0
    ),
    root
  );
  return values;
}

function writeChanged(path: string, value: string): void {
  if (existsSync(path) && readFileSync(path, 'utf8') === value) return;
  const temporary = `${path}.${process.pid}.tmp`;
  try {
    writeFileSync(temporary, value);
    renameReplacing(temporary, path);
  } finally {
    rmSync(temporary, { force: true });
  }
}

if (import.meta.main) writeSpecInputs(resolve(import.meta.dirname, '../../..'));
