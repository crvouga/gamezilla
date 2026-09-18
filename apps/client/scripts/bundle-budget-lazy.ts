#!/usr/bin/env bun
// @io-wall-ok — composition root
/**
 * Lazy-route chunk graph helpers for bundle-budget.
 */
import type { Manifest } from './bundle-budget-manifest';

export function collectChunkClosure(
  manifest: Manifest,
  rootKey: string,
  exclude: ReadonlySet<string>
): string[] {
  const seen = new Set<string>();
  const queue = [rootKey];
  while (queue.length > 0) {
    const key = queue.pop();
    if (key === undefined || seen.has(key) || exclude.has(key)) continue;
    seen.add(key);
    for (const dep of manifest[key]?.imports ?? []) queue.push(dep);
  }
  return [...seen];
}

export function collectLazyRoots(manifest: Manifest): string[] {
  const initialClosure = new Set<string>();
  const queue = Object.keys(manifest).filter(
    (k) => manifest[k]?.isEntry === true
  );
  while (queue.length > 0) {
    const key = queue.pop();
    if (key === undefined || initialClosure.has(key)) continue;
    initialClosure.add(key);
    for (const dep of manifest[key]?.imports ?? []) queue.push(dep);
  }
  const roots = new Set<string>();
  for (const key of initialClosure) {
    for (const dyn of manifest[key]?.dynamicImports ?? []) {
      if (!initialClosure.has(dyn)) roots.add(dyn);
    }
  }
  return [...roots].sort();
}

export function lazyOverrideKey(
  manifestKey: string,
  overrides: Readonly<Record<string, number>>
): string | undefined {
  const norm = manifestKey.split('\\').join('/').toLowerCase();
  const keys = Object.keys(overrides).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    if (norm.includes(key.toLowerCase())) return key;
  }
  return undefined;
}

export function lazyGraphJsFiles(
  manifest: Manifest,
  rootKey: string,
  initialKeys: ReadonlySet<string>
): string[] {
  const keys = collectChunkClosure(manifest, rootKey, initialKeys);
  return keys
    .map((k) => manifest[k]?.file ?? '')
    .filter((f) => f.endsWith('.js'));
}
