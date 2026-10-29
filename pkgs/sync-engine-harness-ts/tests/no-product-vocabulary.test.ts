import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

/**
 * `@pkgs/sync-engine` must stay product-agnostic. Fail if runtime / docs
 * mention host-domain vocabulary (table names, product features, monorepo).
 * The example domain under `src/harness/example-app/` is exempt — it models a domain on purpose.
 */

const PKG_ROOT = join(import.meta.dir, '..');

const SCAN_DIRS = [
  '../sync-engine-client-ts/src',
  '../sync-engine-server-ts/src',
  '../sync-engine-shared-ts/src',
] as const;
const SCAN_FILES = ['../sync-engine-server-ts/README.md'] as const;

/**
 * Word / phrase denylist — keep tight; false positives waste review time.
 * Domain vocabulary only: the host's brand names are not listed here, because
 * the host repository's brand policy already refuses every spelling of them
 * in every file, these included.
 */
const DENY: readonly { readonly re: RegExp; readonly label: string }[] = [
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

const SKIP_LINE = /\.(?:harness\.)?(?:pbt\.)?test\.tsx?/;

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
  const rel = slashPath(relative(PKG_ROOT, path));
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
