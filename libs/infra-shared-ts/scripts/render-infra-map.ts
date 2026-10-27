#!/usr/bin/env bun
// @io-wall-ok — CLI entry: reads the OpenTofu source tree, writes the page.
/**
 * Writes `libs/infra-shared-ts/.cache/infra-map.html`: the infrastructure map, derived entirely from `libs/infra-shared-ts/tofu` (and the deletion
 * allow-list beside it). Needs no credentials, no state and no network.
 *
 *   bun run infra:map
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import { buildInfraModel } from '../src/infra-model';
import { renderInfraMap } from '../src/infra-render';

const PKG_DIR = join(import.meta.dirname, '..');
const REPO_ROOT = join(PKG_DIR, '..', '..');
const OUT_DIR = join(PKG_DIR, '.cache');
const OUT_HTML = join(OUT_DIR, 'infra-map.html');

/** Files the map reads: configuration, tfvars, templates, lock files, policy. */
const SOURCE = /(\.tf|\.json|\.tftpl|\.hcl|\.rego)$/;
const SKIP = new Set(['.terraform', 'node_modules', '.cache']);

function collect(dir: string, into: Map<string, string>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) collect(path, into);
    else if (SOURCE.test(entry.name)) {
      into.set(slashPath(relative(PKG_DIR, path)), readFileSync(path, 'utf8'));
    }
  }
}

function digestOf(sources: ReadonlyMap<string, string>): string {
  const hasher = new Bun.CryptoHasher('sha256');
  for (const path of [...sources.keys()].sort()) {
    hasher.update(`${path}\u0000${sources.get(path)}\u0000`);
  }
  return `sha256:${hasher.digest('hex').slice(0, 16)}`;
}

const sources = new Map<string, string>();
collect(join(PKG_DIR, 'tofu'), sources);
collect(join(PKG_DIR, 'policy'), sources);

const html = renderInfraMap(buildInfraModel(sources), {
  digest: digestOf(sources),
});

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT_HTML, html);
console.log(
  `wrote ${slashPath(relative(REPO_ROOT, OUT_HTML))} (${html.length} bytes)`
);
