#!/usr/bin/env bun
/**
 * Ban React Native StyleSheet / `style=` / RN View|Text|Pressable hosts
 * outside `@pkgs/ui` host adapters and a few third-party/crash allowlists.
 *
 * Product and composed UI must use `sx` on Box / Text / Pressable from
 * `@pkgs/ui`. Host adapters compile `sx` to the native `style` prop.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');
const SCAN_DIRS = ['apps', 'libs', 'pkgs', 'test'];
const SKIP_DIR = new Set(['node_modules', 'dist', '.turbo', 'coverage']);

const HOST_ADAPTERS = new Set([
  'pkgs/ui/src/components/box/box.tsx',
  'pkgs/ui/src/components/text/text.tsx',
  'pkgs/ui/src/components/pressable/pressable.tsx',
  'pkgs/ui/src/components/scroll-view/scroll-view.tsx',
  'pkgs/ui/src/components/flat-list/flat-list.tsx',
  'pkgs/ui/src/components/text-input/text-input.tsx',
  'pkgs/ui/src/components/safe-area-view/safe-area-view.tsx',
  'pkgs/ui/src/components/keyboard-avoiding-view/keyboard-avoiding-view.tsx',
  'pkgs/ui/src/components/gradient-box/gradient-box.tsx',
  'pkgs/ui/src/components/animated-box/animated-box.tsx',
  'pkgs/ui/src/theme/theme-context.tsx',
  'pkgs/ui/src/theme/use-host-sx.ts',
]);

/** Third-party / crash surfaces that still pass `style` to a non-Box host. */
const EXTRA_ALLOW = new Set([
  'apps/client/src/providers/root-error-boundary.tsx',
  'apps/client/src/i18n/i18n-provider.tsx',
  'apps/client/src/providers/shell/gesture-handler.tsx',
  'pkgs/ui/src/theme/app-status-bar.tsx',
  'pkgs/ui/src/components/avatar/avatar.tsx',
  'pkgs/ui/src/components/skeleton/skeleton.tsx',
  'pkgs/ui/src/components/status-bar/status-bar-frost-backdrop.tsx',
  'pkgs/ui/src/components/status-bar/status-bar-overlay.tsx',
  'pkgs/ui/src/components/fade-switch/fade-switch.tsx',
  'pkgs/ui/src/components/mutation-modal/mutation-modal-transition.tsx',
  'pkgs/ui/src/components/horizontal-picker/horizontal-picker-cell.tsx',
  'pkgs/ui/src/components/horizontal-picker/horizontal-picker-list.tsx',
  'pkgs/ui/src/components/responsive-surface/responsive-surface.tsx',
  'pkgs/chess-board/src/chess-board-canvas-content.tsx',
  'pkgs/chess-board/src/chess-board-promotion.tsx',
  'pkgs/chess-board/src/chess-board-drag-preview.tsx',
  'pkgs/chess-board/src/chess-board-feedback.tsx',
  'pkgs/ui-testing/src/drivers/in-process/demo-app.tsx',
]);

const BANNED_HOSTS = new Set([
  'View',
  'Text',
  'Pressable',
  'SafeAreaView',
  'ScrollView',
  'FlatList',
]);

const STYLE_JSX_RE =
  /\b(style|contentContainerStyle|columnWrapperStyle)\s*=\s*\{/g;
const STYLESHEET_IMPORT_RE =
  /\bimport\s+(?!type\b)[^;]*?\bStyleSheet\b[^;]*?\bfrom\s*['"]react-native(?:-web)?['"]/g;
const VALUE_RN_IMPORT_RE =
  /\bimport\s+(?!type\b)([^;]*?)\bfrom\s*['"]react-native['"]/g;

type Violation = { file: string; detail: string };

function isExempt(rel: string): boolean {
  if (HOST_ADAPTERS.has(rel) || EXTRA_ALLOW.has(rel)) return true;
  if (/\.(test|spec)\.(ts|tsx)$/.test(rel)) return true;
  if (rel.includes('/fixtures/')) return true;
  if (rel.includes('serialize-host-tree-html')) return true;
  if (rel.includes('/demo-app.')) return true;
  // Standalone browser SPA — not RN / @pkgs/ui product chrome.
  if (rel.startsWith('pkgs/simulation-report/')) return true;
  return false;
}

function walk(dir: string, files: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIR.has(entry.name)) continue;
      walk(join(dir, entry.name), files);
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(join(dir, entry.name));
    }
  }
}

function bannedSpecifiers(clause: string): string[] {
  const brace = clause.match(/\{([^}]*)\}/);
  if (!brace?.[1]) return [];
  const out: string[] = [];
  for (const raw of brace[1].split(',')) {
    const part = raw.trim();
    if (part.length === 0 || part.startsWith('type ')) continue;
    const name = part.split(/\s+as\s+/)[0]?.trim();
    if (name && BANNED_HOSTS.has(name)) out.push(name);
  }
  return out;
}

function scanFile(rel: string, content: string): Violation[] {
  const violations: Violation[] = [];
  for (const match of content.matchAll(STYLESHEET_IMPORT_RE)) {
    violations.push({
      file: rel,
      detail: match[0].replace(/\s+/g, ' ').trim(),
    });
  }
  if (rel.endsWith('.tsx')) {
    for (const match of content.matchAll(STYLE_JSX_RE)) {
      violations.push({
        file: rel,
        detail: match[0].replace(/\s+/g, ' ').trim(),
      });
    }
  }
  for (const match of content.matchAll(VALUE_RN_IMPORT_RE)) {
    const clause = match[1] ?? '';
    for (const name of bannedSpecifiers(clause)) {
      violations.push({
        file: rel,
        detail: `value import ${name} from 'react-native'`,
      });
    }
  }
  return violations;
}

function findViolations(): Violation[] {
  const violations: Violation[] = [];
  for (const scanDir of SCAN_DIRS) {
    const abs = join(REPO_ROOT, scanDir);
    try {
      if (!statSync(abs).isDirectory()) continue;
    } catch {
      continue;
    }
    const files: string[] = [];
    walk(abs, files);
    for (const file of files) {
      const rel = relative(REPO_ROOT, file);
      if (isExempt(rel)) continue;
      violations.push(...scanFile(rel, readFileSync(file, 'utf8')));
    }
  }
  return violations;
}

const violations = findViolations();
if (violations.length === 0) {
  console.log(
    'ci:no-rn-style-api ok — style via @pkgs/ui sx (host adapters allowlisted)'
  );
  process.exit(0);
}

console.error(
  'ci:no-rn-style-api FAILED — use Box/Text/Pressable + sx from @pkgs/ui.\n' +
    'RN StyleSheet / style= / View|Text|Pressable hosts are only allowed in\n' +
    'host adapters, the crash boundary, and listed third-party hosts.\n'
);
for (const v of violations) {
  console.error(`  - ${v.file}: ${v.detail}`);
}
process.exit(1);
