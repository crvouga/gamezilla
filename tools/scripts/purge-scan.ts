#!/usr/bin/env bun
// @io-wall-ok — tools composition root
/**
 * Fail if any React Native / Expo / React token survives in the repo.
 *
 * `tools/port/purge-allowlist.json` lists path prefixes that are still
 * allowed to contain those tokens while the Solid port is in flight.
 * Directories in `tools/port/solid-scope.json` are always scanned.
 * The allowlist must be empty (and this comment stale) when Phase 5 closes.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const REPO_ROOT = join(import.meta.dirname, '../..');

const TEXT_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
  '.mts',
  '.json',
  '.jsonc',
  '.md',
  '.toml',
  '.yml',
  '.yaml',
  '.html',
  '.css',
  '.grit',
  '.po',
]);

/** Banned tokens. Each entry is `[label, regex]`; regexes are line-scoped. */
export const BANNED: ReadonlyArray<readonly [string, RegExp]> = [
  ['react-native', /react-native/],
  ['expo', /(^|[^a-zA-Z])expo(?![a-zA-Z])/],
  ['@expo', /@expo\//],
  ['metro', /(^|[^a-zA-Z])metro(?![a-zA-Z])/i],
  ['hermes', /(^|[^a-zA-Z])hermes(?![a-zA-Z])/i],
  ['eas', /(^|[^a-zA-Z])eas(\.json|-cli| build| update)/],
  ['react-navigation', /@react-navigation/],
  ['skia', /react-native-skia|canvaskit/i],
  ['reanimated', /reanimated/],
  ['gesture-handler', /gesture-handler/],
  ['react import', /from\s+['"]react(-dom)?(\/[^'"]*)?['"]/],
  ['react types', /\bReact(Node|Element|\.FC|\.ReactNode|\.ComponentProps)\b/],
  [
    'react hooks',
    /\buse(Effect|State|Memo|Callback|Ref|LayoutEffect|Reducer)\(/,
  ],
  ['jsxImportSource react', /@jsxImportSource\s+react\b/],
  ['StyleSheet', /\bStyleSheet\.(create|flatten|absoluteFill)/],
  ['Platform.OS', /\bPlatform\.(OS|select)\b/],
  [
    'RN primitives',
    /\b(FlatList|SectionList|SafeAreaView|KeyboardAvoidingView|TouchableOpacity|TouchableWithoutFeedback|Pressable|useWindowDimensions)\b/,
  ],
  ['AsyncStorage', /AsyncStorage/],
  ['EXPO_PUBLIC_', /EXPO_PUBLIC_/],
] as const;

type Allowlist = { prefixes: string[] };
type SolidScope = { dirs: string[]; files: string[] };

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(join(REPO_ROOT, rel), 'utf8')) as T;
}

function hasTextExtension(name: string): boolean {
  const dot = name.lastIndexOf('.');
  if (dot === -1) return false;
  return TEXT_EXTENSIONS.has(name.slice(dot));
}

/** Git-tracked text files (posix-relative). Untracked run artifacts are irrelevant. */
function trackedTextFiles(): string[] {
  const result = spawnSync('git', ['ls-files', '-z'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(`git ls-files failed: ${result.stderr}`);
  }
  return result.stdout
    .split('\0')
    .filter((rel) => rel !== '' && hasTextExtension(rel));
}

export function isAllowlisted(
  relFile: string,
  allowlist: readonly string[],
  scope: SolidScope
): boolean {
  if (scope.files.includes(relFile)) return false;
  if (scope.dirs.some((dir) => relFile.startsWith(`${dir}/`))) return false;
  return allowlist.some((prefix) =>
    prefix.endsWith('/') ? relFile.startsWith(prefix) : relFile === prefix
  );
}

export function scanText(text: string): Array<{ line: number; label: string }> {
  const hits: Array<{ line: number; label: string }> = [];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    for (const [label, regex] of BANNED) {
      if (regex.test(line)) hits.push({ line: i + 1, label });
    }
  }
  return hits;
}

function selfPath(rel: string): boolean {
  return (
    rel === 'tools/scripts/purge-scan.ts' ||
    rel === 'tools/scripts/purge-scan.test.ts' ||
    rel === 'tools/port/purge-allowlist.json' ||
    rel === 'tools/port/solid-scope.json'
  );
}

function main(): void {
  const allowlist = readJson<Allowlist>('tools/port/purge-allowlist.json');
  const scope = readJson<SolidScope>('tools/port/solid-scope.json');
  const failures: string[] = [];
  let scanned = 0;
  for (const rel of trackedTextFiles()) {
    if (selfPath(rel)) continue;
    if (isAllowlisted(rel, allowlist.prefixes, scope)) continue;
    const abs = join(REPO_ROOT, rel);
    if (statSync(abs).size > 4 * 1024 * 1024) continue;
    scanned++;
    for (const hit of scanText(readFileSync(abs, 'utf8'))) {
      failures.push(`${rel}:${String(hit.line)} — ${hit.label}`);
    }
  }

  if (failures.length > 0) {
    console.error(
      `[purge-scan] ${String(failures.length)} banned React Native / Expo / React token(s):\n` +
        failures.map((f) => `  ${f}`).join('\n')
    );
    process.exit(1);
  }
  console.log(
    `[purge-scan] clean: ${String(scanned)} files scanned, ${String(allowlist.prefixes.length)} allowlist prefixes remaining`
  );
}

if (import.meta.main) main();
