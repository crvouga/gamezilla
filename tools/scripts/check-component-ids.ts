#!/usr/bin/env bun
/**
 * Fail-fast guardrail: every visual `@pkgs/ui` component folder must call
 * `componentDataSet('<Name>'` so web DOM identifiers stay wired.
 *
 * Skips non-visual / infrastructure folders (hooks, portals, icon factories,
 * theme tokens, explorer tooling).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dir, '../..');
const COMPONENTS_DIR = join(REPO_ROOT, 'pkgs/ui/src/components');

/** Folders that intentionally do not render a DOM host with component ids. */
const SKIP_FOLDERS = new Set([
  'compose-providers',
  'content-edge-padding',
  'explorer',
  'focus-trap',
  'icons',
  'optional-props',
  'overlay-portal',
  'portal-content-bridge',
  'skia-web-root',
  'surface-stack',
  'symbol-icon',
  'theme-tokens',
  'use-breadcrumb-nav',
]);

const COMPONENT_DATA_SET_RE = /componentDataSet\s*\(\s*['"]([A-Za-z0-9_]+)['"]/;

function listComponentFolders(): string[] {
  return readdirSync(COMPONENTS_DIR).filter((name) => {
    if (name === 'index.ts' || name.startsWith('.')) return false;
    const full = join(COMPONENTS_DIR, name);
    return statSync(full).isDirectory();
  });
}

function folderHasComponentDataSet(folder: string): boolean {
  const dir = join(COMPONENTS_DIR, folder);
  const files = readdirSync(dir, { recursive: true, encoding: 'utf8' });
  for (const rel of files) {
    if (typeof rel !== 'string') continue;
    if (!rel.endsWith('.tsx') && !rel.endsWith('.ts')) continue;
    if (rel.includes('.example.') || rel.includes('.test.')) continue;
    const source = readFileSync(join(dir, rel), 'utf8');
    if (COMPONENT_DATA_SET_RE.test(source)) return true;
  }
  return false;
}

const missing: string[] = [];
for (const folder of listComponentFolders()) {
  if (SKIP_FOLDERS.has(folder)) continue;
  if (!folderHasComponentDataSet(folder)) {
    missing.push(relative(REPO_ROOT, join(COMPONENTS_DIR, folder)));
  }
}

if (missing.length > 0) {
  console.error(
    'Missing componentDataSet(...) in @pkgs/ui component folders:\n' +
      missing.map((m) => `  - ${m}`).join('\n') +
      "\n\nAdd `{...componentDataSet('<Name>', dataSet)}` on the root host " +
      '(see pkgs/ui/src/component-id/). Non-visual folders belong in SKIP_FOLDERS.'
  );
  process.exit(1);
}

const checked = listComponentFolders().length - SKIP_FOLDERS.size;
console.log(
  `ci:component-ids ok — ${checked} visual component folders have componentDataSet`
);
