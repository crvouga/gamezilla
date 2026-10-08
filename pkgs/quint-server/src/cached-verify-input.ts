// @io-wall-ok — private verifier inputs preserve the source's import graph.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { newIdGenerator, parsePhase1fromText } from '@informalsystems/quint';
import { cacheValueParameters } from './cache-value-parameters';

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
  const root = join(outDir, 'cached-source');
  const visited = new Set<string>();
  const destination = (path: string) => join(root, path.replace(/^[/\\]+/, ''));
  const copy = (path: string): void => {
    if (visited.has(path)) return;
    visited.add(path);
    const source = readFileSync(path, 'utf8');
    const parsed = parsePhase1fromText(newIdGenerator(), source, path);
    const target = destination(path);
    mkdirSync(dirname(target), { recursive: true });
    // Invalid input still reaches the compiler for its normal diagnostic.
    writeFileSync(
      target,
      parsed.errors.length === 0 ? cacheValueParameters(source) : source
    );
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
