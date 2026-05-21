/**
 * Resolve the Postgres CLI binaries (`postgres`, `pg_ctl`, `initdb`,
 * `pg_isready`) we need for the lifecycle, with cross-platform fallbacks.
 *
 * Lookup order (first hit wins):
 *
 * 1. `PG_BIN_DIR` env var (explicit override; useful when the user has
 *    multiple Postgres installs and wants a specific one).
 * 2. `<binary>` on `PATH` (covers Linux, WSL, and Homebrew installs that linked
 *    `postgresql` into `/usr/local/bin` or `/opt/homebrew/bin`).
 * 3. Well-known macOS Homebrew install prefixes for keg-only `postgresql@N`
 *    formulas (`/opt/homebrew/opt/postgresql@N/bin` on Apple Silicon,
 *    `/usr/local/opt/postgresql@N/bin` on Intel).
 *
 * If all lookups fail, we emit an actionable install hint per platform instead
 * of a cryptic `ENOENT`.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';

export type PostgresBinaryName =
  | 'postgres'
  | 'pg_ctl'
  | 'initdb'
  | 'pg_isready';

export const REQUIRED_BINARIES: ReadonlyArray<PostgresBinaryName> = [
  'postgres',
  'pg_ctl',
  'initdb',
  'pg_isready',
];

export interface ResolvedBinaries {
  /** Absolute path of each required binary, keyed by name. */
  readonly paths: Readonly<Record<PostgresBinaryName, string>>;
  /** Where they were found ("PATH", "PG_BIN_DIR", or a well-known prefix). */
  readonly source: string;
}

function isWindows(): boolean {
  return process.platform === 'win32';
}

function exeName(name: PostgresBinaryName): string {
  return isWindows() ? `${name}.exe` : name;
}

function whichOne(name: PostgresBinaryName): string | null {
  const cmd = isWindows() ? 'where' : 'which';
  const r = spawnSync(cmd, [exeName(name)], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });
  if (r.status !== 0 || r.error) return null;
  const stdout = (r.stdout ?? '').toString().trim();
  if (stdout === '') return null;
  // `where` on Windows can return multiple paths separated by newlines; take
  // the first valid line.
  const first = stdout.split(/\r?\n/).find((line) => line.trim().length > 0);
  if (!first) return null;
  return resolve(first.trim());
}

function fromBinDir(binDir: string): Record<PostgresBinaryName, string> | null {
  const out: Partial<Record<PostgresBinaryName, string>> = {};
  for (const name of REQUIRED_BINARIES) {
    const full = join(binDir, exeName(name));
    if (!existsSync(full)) return null;
    out[name] = full;
  }
  return out as Record<PostgresBinaryName, string>;
}

/**
 * Common Homebrew install prefixes for keg-only `postgresql@N` formulas. We
 * prefer the highest version we can find so a user with both `postgresql@16`
 * and `postgresql@17` ends up on 17 unless they pin via `PG_BIN_DIR`.
 */
function homebrewKegBinDirs(): string[] {
  if (process.platform !== 'darwin') return [];
  const prefixes = ['/opt/homebrew/opt', '/usr/local/opt'];
  const formulaCandidates: string[] = [
    'postgresql',
    'postgresql@17',
    'postgresql@16',
    'postgresql@15',
    'postgresql@14',
  ];
  const out: string[] = [];
  for (const prefix of prefixes) {
    for (const formula of formulaCandidates) {
      const dir = join(prefix, formula, 'bin');
      if (existsSync(dir)) out.push(dir);
    }
  }
  return out;
}

/**
 * Generic Linux install prefixes that ship Postgres in a versioned bin dir
 * (e.g. `postgresql-common` on Debian/Ubuntu installs to
 * `/usr/lib/postgresql/<major>/bin`).
 */
function linuxVersionedBinDirs(): string[] {
  if (process.platform !== 'linux') return [];
  const base = '/usr/lib/postgresql';
  if (!existsSync(base)) return [];
  const versions = ['17', '16', '15', '14'];
  return versions.map((v) => join(base, v, 'bin')).filter((d) => existsSync(d));
}

export interface MissingBinariesError {
  readonly missing: ReadonlyArray<PostgresBinaryName>;
  readonly hint: string;
}

function installHint(): string {
  if (process.platform === 'darwin') {
    return [
      'Install via Homebrew:',
      '  brew install postgresql@17',
      'Then either:',
      "  - add `$(brew --prefix postgresql@17)/bin' to PATH, or",
      '  - export PG_BIN_DIR="$(brew --prefix postgresql@17)/bin"',
    ].join('\n');
  }
  if (process.platform === 'linux') {
    return [
      'Install Postgres server tooling, e.g.:',
      '  Debian/Ubuntu: sudo apt-get install -y postgresql',
      '  Fedora/RHEL : sudo dnf install -y postgresql-server',
      '  Arch        : sudo pacman -S postgresql',
      'Make sure `postgres`, `pg_ctl`, `initdb`, `pg_isready` are on PATH ',
      '(or set PG_BIN_DIR=/usr/lib/postgresql/<version>/bin).',
    ].join('\n');
  }
  if (process.platform === 'win32') {
    return [
      'Native Windows is not supported by `@pkgs/pg`. Run dev inside WSL2:',
      '  https://learn.microsoft.com/en-us/windows/wsl/install',
      'Then install Postgres in the WSL distro and re-run `bun run dev`.',
    ].join('\n');
  }
  return 'Install PostgreSQL and ensure `postgres`, `pg_ctl`, `initdb`, `pg_isready` are on PATH.';
}

function gatherBinDirCandidates(): Array<{ source: string; binDir: string }> {
  const candidates: Array<{ source: string; binDir: string }> = [];
  const override = process.env['PG_BIN_DIR']?.trim();
  if (override !== undefined && override !== '') {
    candidates.push({ source: `PG_BIN_DIR=${override}`, binDir: override });
  }
  for (const dir of homebrewKegBinDirs()) {
    candidates.push({ source: `homebrew (${dir})`, binDir: dir });
  }
  for (const dir of linuxVersionedBinDirs()) {
    candidates.push({ source: `linux pkg (${dir})`, binDir: dir });
  }
  return candidates;
}

function resolveFromPath():
  | ResolvedBinaries
  | { missing: PostgresBinaryName[] } {
  const fromPath: Partial<Record<PostgresBinaryName, string>> = {};
  const missing: PostgresBinaryName[] = [];
  for (const name of REQUIRED_BINARIES) {
    const found = whichOne(name);
    if (found === null) missing.push(name);
    else fromPath[name] = found;
  }
  if (missing.length === 0) {
    return {
      paths: fromPath as Record<PostgresBinaryName, string>,
      source: 'PATH',
    };
  }
  return { missing };
}

/**
 * Locate the four Postgres binaries we depend on. Throws a clear, actionable
 * error if any are missing.
 */
export function resolvePostgresBinaries(): ResolvedBinaries {
  for (const c of gatherBinDirCandidates()) {
    const found = fromBinDir(c.binDir);
    if (found !== null) return { paths: found, source: c.source };
  }

  const path = resolveFromPath();
  if ('paths' in path) return path;

  throw new Error(
    [
      `Missing PostgreSQL CLI tools: ${path.missing.join(', ')}`,
      '',
      installHint(),
    ].join('\n')
  );
}
