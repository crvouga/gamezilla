// @io-wall-ok — exercise the real workspace graph without hashing product source.
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Graph resolution needs manifests, lockfile and task configs, not build inputs. */
export function createTurboGraphFixture(source: string): string {
  const root = mkdtempSync(join(tmpdir(), 'turbo-graph-'));
  for (const file of ['package.json', 'bun.lock', 'turbo.json'])
    copyFileSync(join(source, file), join(root, file));
  for (const tier of ['apps', 'libs', 'pkgs']) {
    for (const entry of readdirSync(join(source, tier), {
      withFileTypes: true,
    })) {
      if (!entry.isDirectory()) continue;
      const directory = join(tier, entry.name);
      mkdirSync(join(root, directory), { recursive: true });
      for (const name of ['package.json', 'turbo.json']) {
        const path = join(directory, name);
        if (existsSync(join(source, path)))
          copyFileSync(join(source, path), join(root, path));
      }
    }
  }
  return root;
}
