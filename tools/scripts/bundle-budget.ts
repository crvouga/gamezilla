#!/usr/bin/env bun
// @io-wall-ok — tools composition root
/**
 * Fail if the initial route's JavaScript (entry chunk + every statically
 * imported chunk) exceeds the gzip budget. Reads Vite's build manifest.
 *
 * usage: bundle-budget.ts <dist-dir> [--budget-kb=200]
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

type ManifestChunk = {
  file: string;
  isEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
  css?: string[];
};

type Manifest = Record<string, ManifestChunk>;

export function collectInitialChunks(manifest: Manifest): string[] {
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
  return [...seen].map((key) => manifest[key]?.file ?? '').filter(Boolean);
}

function gzipBytes(abs: string): number {
  return gzipSync(readFileSync(abs), { level: 9 }).byteLength;
}

function parseBudgetKb(argv: readonly string[]): number {
  const flag = argv.find((a) => a.startsWith('--budget-kb='));
  if (flag === undefined) return 200;
  const n = Number(flag.slice('--budget-kb='.length));
  if (!Number.isFinite(n) || n <= 0) throw new Error(`bad budget: ${flag}`);
  return n;
}

function main(): void {
  const [distDir, ...rest] = process.argv.slice(2);
  if (distDir === undefined) {
    console.error('usage: bundle-budget.ts <dist-dir> [--budget-kb=200]');
    process.exit(2);
  }
  const budgetKb = parseBudgetKb(rest);
  const manifestPath = join(distDir, '.vite', 'manifest.json');
  if (!existsSync(manifestPath)) {
    console.error(
      `[bundle-budget] missing ${manifestPath}; run the build first`
    );
    process.exit(1);
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Manifest;
  const files = collectInitialChunks(manifest).filter((f) => f.endsWith('.js'));

  let total = 0;
  const rows: string[] = [];
  for (const file of files) {
    const bytes = gzipBytes(join(distDir, file));
    total += bytes;
    rows.push(`  ${(bytes / 1024).toFixed(1).padStart(8)} KB  ${file}`);
  }
  const totalKb = total / 1024;
  const verdict = totalKb <= budgetKb ? 'OK' : 'OVER BUDGET';
  console.log(
    `[bundle-budget] initial JS gzip ${totalKb.toFixed(1)} KB / ${String(budgetKb)} KB — ${verdict}\n${rows.join('\n')}`
  );
  if (totalKb > budgetKb) process.exit(1);
}

if (import.meta.main) main();
