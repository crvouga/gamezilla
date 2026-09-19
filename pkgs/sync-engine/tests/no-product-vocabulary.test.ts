import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * `@pkgs/sync-engine` must stay product-agnostic. Fail if runtime / docs
 * mention host-domain vocabulary (table names, product features, monorepo).
 * The example domain under `src/sim/example-app/` is exempt — it models a domain on purpose.
 */

const PKG_ROOT = join(import.meta.dir, '..');

const SCAN_DIRS = [
  'src/client',
  'src/server',
  'src/shared',
  'src/queries',
  'src/mutations',
  'src/protocol',
  'src/sql-ast',
  'src/sim',
] as const;

const SCAN_FILES = ['README.md', 'docs/CONTRACTS.md'] as const;

/** Word / phrase denylist — keep tight; false positives waste review time. */
const DENY: readonly { readonly re: RegExp; readonly label: string }[] = [
  { re: /\bgamezilla\b/i, label: 'gamezilla' },
  { re: /\bspaces_users\b/, label: 'spaces_users' },
  { re: /\bspaces_open_sessions\b/, label: 'spaces_open_sessions' },
  { re: /\bensureProfile\b/, label: 'ensureProfile' },
  { re: /\bfriends_friendships\b/, label: 'friends_friendships' },
  { re: /\bfriendship\b/i, label: 'friendship' },
  { re: /\busername\b/i, label: 'username' },
  { re: /\bhost_member_id\b/, label: 'host_member_id' },
  { re: /\bhost_account_id\b/, label: 'host_account_id' },
  { re: /\bspaceId\b/, label: 'spaceId' },
  { re: /\bspace_id\b/, label: 'space_id' },
  { re: /\bspaces\b/i, label: 'spaces' },
  { re: /\bnotes\b/i, label: 'notes' },
  { re: /\bfolders\b/i, label: 'folders' },
  { re: /\bchess\b/i, label: 'chess' },
  { re: /\bpuzzle\b/i, label: 'puzzle' },
  // Quoted / SQL-ish profile table refs — not English "profile" alone.
  { re: /['"`]profile['"`]/, label: 'profile-table' },
  { re: /\bFROM profile\b/i, label: 'FROM profile' },
  { re: /\bINTO profile\b/i, label: 'INTO profile' },
];

const SKIP_LINE = /\.(?:sim\.)?(?:pbt\.)?test\.tsx?/;

function walkFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) {
      if (name === 'node_modules' || name === 'dist' || name === 'example-app')
        continue;
      out.push(...walkFiles(path));
      continue;
    }
    if (/\.(ts|tsx|md)$/.test(name)) out.push(path);
  }
  return out;
}

function scanFile(path: string): string[] {
  const rel = relative(PKG_ROOT, path);
  const hits: string[] = [];
  const lines = readFileSync(path, 'utf8').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (SKIP_LINE.test(line)) continue;
    for (const { re, label } of DENY) {
      if (re.test(line)) {
        hits.push(`${rel}:${i + 1} [${label}] ${line.trim().slice(0, 120)}`);
      }
    }
  }
  return hits;
}

describe('no product vocabulary in sync-engine runtime', () => {
  test('runtime + docs stay domain-agnostic', () => {
    const files: string[] = [];
    for (const dir of SCAN_DIRS) {
      files.push(...walkFiles(join(PKG_ROOT, dir)));
    }
    for (const file of SCAN_FILES) {
      files.push(join(PKG_ROOT, file));
    }
    const hits = files.flatMap(scanFile);
    expect(hits).toEqual([]);
  });
});
