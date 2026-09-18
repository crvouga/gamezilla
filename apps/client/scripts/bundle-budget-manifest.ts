#!/usr/bin/env bun
// @io-wall-ok — composition root
/** Shared Vite manifest types + initial-graph collectors for bundle-budget. */
export type ManifestChunk = {
  file: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
};

export type Manifest = Record<string, ManifestChunk>;

export function collectInitialChunkKeys(manifest: Manifest): string[] {
  const seen = new Set<string>();
  const queue = Object.keys(manifest).filter(
    (key) => manifest[key]?.isEntry === true
  );
  while (queue.length > 0) {
    const key = queue.pop();
    if (key === undefined || seen.has(key)) continue;
    seen.add(key);
    for (const dep of manifest[key]?.imports ?? []) queue.push(dep);
  }
  return [...seen];
}

export function collectInitialJsFiles(manifest: Manifest): string[] {
  return collectInitialChunkKeys(manifest)
    .map((key) => manifest[key]?.file ?? '')
    .filter((f) => f.endsWith('.js'));
}

export function collectInitialCssFiles(manifest: Manifest): string[] {
  const css = new Set<string>();
  for (const key of collectInitialChunkKeys(manifest)) {
    for (const href of manifest[key]?.css ?? []) css.add(href);
  }
  return [...css];
}

export function pathMatchesDeferred(
  relPath: string,
  patterns: readonly string[]
): boolean {
  const norm = relPath.split('\\').join('/');
  return patterns.some((p) => norm.includes(p));
}

export function assertNoDeferredOnInitial(args: {
  readonly files: readonly string[];
  readonly patterns: readonly string[];
}): string[] {
  return args.files.filter((f) => pathMatchesDeferred(f, args.patterns));
}

export function findEntryHtmlPreloadHits(args: {
  readonly html: string;
  readonly patterns: readonly string[];
}): string[] {
  const hits: string[] = [];
  const re =
    /<(?:link|script)\b[^>]*(?:href|src)\s*=\s*['"]([^'"]+)['"][^>]*>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(args.html)) !== null) {
    const href = m[1];
    if (href === undefined) continue;
    if (pathMatchesDeferred(href, args.patterns)) hits.push(href);
  }
  return hits;
}
