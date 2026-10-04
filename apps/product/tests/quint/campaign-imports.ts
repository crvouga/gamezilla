// @io-wall-ok — campaign evidence follows the model's transitive source imports.
import { readdirSync, readFileSync } from 'node:fs';
import { MODEL_DIR, modelPath } from './campaign-config';

export function importedModels(
  sources: ReadonlyMap<string, string>,
  root: string
): readonly string[] {
  const reached = new Set<string>();
  const pending = [root];
  for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
    if (reached.has(name)) continue;
    const source = sources.get(name);
    if (source === undefined)
      throw new Error(`Campaign import is missing: ${name}`);
    reached.add(name);
    for (const match of source.matchAll(/\bfrom "\.\/([a-z0-9-]+)"/g))
      pending.push(match[1]!);
  }
  return [...reached].sort();
}

export function campaignImports(root: string): readonly string[] {
  const sources = new Map(
    readdirSync(MODEL_DIR)
      .filter((name) => name.endsWith('.qnt'))
      .map((file) => {
        const name = file.slice(0, -4);
        return [name, readFileSync(modelPath(name), 'utf8')] as const;
      })
  );
  return importedModels(sources, root);
}
