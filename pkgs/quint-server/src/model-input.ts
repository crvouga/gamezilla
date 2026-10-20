// @io-wall-ok — private verifier inputs preserve the source's import graph.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { newIdGenerator, parsePhase1fromText } from '@informalsystems/quint';
import type { ModelParameters } from '@pkgs/quint-shared/registry';
import { cacheValueParameters } from './cache-value-parameters';
import { instantiateModel } from './model-parameters';
import { quintModuleName } from './model-source';

function importSources(
  parsed: ReturnType<typeof parsePhase1fromText>
): string[] {
  const sources: string[] = [];
  for (const module of parsed.modules) {
    for (const declaration of module.declarations) {
      if (
        'fromSource' in declaration &&
        typeof declaration.fromSource === 'string'
      )
        sources.push(declaration.fromSource);
    }
  }
  return sources;
}

/** Cache repeated value arguments without changing any model obligation. */
export function cachedVerifyInput(specPath: string, outDir: string): string {
  return copyInput(specPath, join(outDir, 'cached-source'), (source, path) => {
    const parsed = parsePhase1fromText(newIdGenerator(), source, path);
    return parsed.errors.length === 0 ? cacheValueParameters(source) : source;
  });
}

/** Preserve imports while closing only the selected main module's constants. */
export function instantiatedModelInput(
  specPath: string,
  outDir: string,
  parameters: ModelParameters
): string {
  const main = resolve(specPath);
  return copyInput(main, join(outDir, 'instantiated-source'), (source, path) =>
    path === main
      ? instantiateModel(source, quintModuleName(main), parameters)
      : source
  );
}

function copyInput(
  specPath: string,
  root: string,
  transform: (source: string, path: string) => string
): string {
  const visited = new Set<string>();
  const destination = (path: string) => join(root, path.replace(/^[/\\]+/, ''));
  const copy = (path: string): void => {
    if (visited.has(path)) return;
    visited.add(path);
    const source = readFileSync(path, 'utf8');
    const parsed = parsePhase1fromText(newIdGenerator(), source, path);
    const target = destination(path);
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, transform(source, path));
    for (const from of importSources(parsed)) {
      const dependency = resolve(
        dirname(path),
        from.endsWith('.qnt') ? from : `${from}.qnt`
      );
      if (existsSync(dependency)) copy(dependency);
    }
  };
  const absolute = resolve(specPath);
  copy(absolute);
  return destination(absolute);
}
