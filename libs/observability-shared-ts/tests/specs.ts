// @io-wall-ok — reads the committed objective files and generated artifacts.
/** The repository's objective files, read as the checks and the generator read them. */

import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { parseObjectiveFiles } from '@libs/observability-shared-ts/objective-files';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

export const REPO_ROOT = resolve(import.meta.dir, '../../..');

export function readRepoFile(path: string): string {
  return readFileSync(join(REPO_ROOT, path), 'utf8');
}

export function objectiveTexts(): { path: string; text: string }[] {
  const specs = join(REPO_ROOT, 'specs');
  const out: { path: string; text: string }[] = [];
  for (const context of readdirSync(specs, { withFileTypes: true })) {
    if (!context.isDirectory()) continue;
    for (const file of readdirSync(join(specs, context.name))) {
      if (!file.endsWith('.openslo.yaml')) continue;
      const full = join(specs, context.name, file);
      out.push({
        path: slashPath(relative(REPO_ROOT, full)),
        text: readFileSync(full, 'utf8'),
      });
    }
  }
  return out.sort((a, b) => a.path.localeCompare(b.path));
}

export function objectiveFiles() {
  return parseObjectiveFiles(objectiveTexts());
}
