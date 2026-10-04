// @io-wall-ok — verification evidence hashes the complete local model source set.
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { MODEL_DIR, REPO_ROOT } from './campaign-config';

const SOURCES = /^\/\/ Sources: (specs\/[a-z0-9-]+(?:, specs\/[a-z0-9-]+)*)$/m;

function interpretationSources(directory: string): readonly string[] {
  const sources = new Set<string>();
  for (const file of readdirSync(directory).filter((name) =>
    name.endsWith('.qnt')
  )) {
    const source = readFileSync(join(directory, file), 'utf8');
    const declared = SOURCES.exec(source)?.[1]?.split(', ') ?? [];
    for (const path of declared) sources.add(path);
  }
  return [...sources].sort();
}

export function sourceDigest(directory = MODEL_DIR): string {
  const hash = createHash('sha256');
  for (const file of readdirSync(directory)
    .filter((name) => name.endsWith('.qnt'))
    .sort()) {
    hash.update(`interpretation/${file}\0`);
    hash.update(readFileSync(join(directory, file)));
    hash.update('\0');
  }
  for (const sourceDir of interpretationSources(directory)) {
    for (const file of readdirSync(join(REPO_ROOT, sourceDir)).sort()) {
      const path = join(REPO_ROOT, sourceDir, file);
      hash.update(`${sourceDir}/${file}\0`);
      hash.update(readFileSync(path));
      hash.update('\0');
    }
  }
  return hash.digest('hex');
}
