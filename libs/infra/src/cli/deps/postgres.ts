import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { captureVersion, spawnInstall, verifyRun, whichSync } from './spawn';
import type { Dep, DepStatus } from './types';

/**
 * Required CLI tooling for the local PostgreSQL cluster managed by
 * `@pkgs/pg` (see `pkgs/pg/src/dev.ts`).
 *
 * We need four binaries: `postgres` (server), `pg_ctl` (lifecycle),
 * `initdb` (cluster bootstrap), `pg_isready` (readiness probe). All ship
 * together in the standard PostgreSQL distribution.
 *
 * Version policy:
 *
 * - `version()` reports the `postgres` major.minor (e.g. `17.4`) extracted from
 *   `postgres --version`.
 * - `fetchLatestVersion()` returns `null` on purpose. PostgreSQL releases use
 *   tags like `REL_17_6` that are not directly comparable to the runtime
 *   `17.4` string our `semverCompare` understands; rather than ship a fragile
 *   parser that occasionally flags `deploy` as outdated for cosmetic reasons,
 *   we let `setup`/`status` warn "could not resolve latest" and rely on
 *   `check()` for hard enforcement that the binaries exist.
 *
 * Install policy mirrors `StripeDep`: macOS via Homebrew, Linux/Windows via
 * explicit guidance — we do not silently `apt-get install` on a developer's
 * machine, but we also never fall through with a cryptic ENOENT.
 */
const REQUIRED_BINARIES = [
  'postgres',
  'pg_ctl',
  'initdb',
  'pg_isready',
] as const;

const HOMEBREW_FORMULA = 'postgresql@17';

function isMacOS(): boolean {
  return process.platform === 'darwin';
}

function isLinux(): boolean {
  return process.platform === 'linux';
}

function hasHomebrew(): boolean {
  return whichSync('brew');
}

/**
 * Homebrew installs `postgresql@N` keg-only (not on default PATH). Look in
 * the standard Apple-Silicon and Intel install prefixes for an existing
 * cluster bin directory so `check()` doesn't false-negative right after
 * `brew install`.
 */
function homebrewKegBinDir(): string | null {
  if (!isMacOS()) return null;
  const prefixes = ['/opt/homebrew/opt', '/usr/local/opt'];
  const formulas = [
    HOMEBREW_FORMULA,
    'postgresql@16',
    'postgresql@15',
    'postgresql',
  ];
  for (const prefix of prefixes) {
    for (const formula of formulas) {
      const dir = join(prefix, formula, 'bin');
      if (REQUIRED_BINARIES.every((b) => existsSync(join(dir, b)))) {
        return dir;
      }
    }
  }
  return null;
}

function findCanonicalBin(): string | null {
  if (REQUIRED_BINARIES.every((b) => whichSync(b))) return 'postgres';
  const kegDir = homebrewKegBinDir();
  if (kegDir !== null) return join(kegDir, 'postgres');
  return null;
}

function missingBinaries(): readonly string[] {
  if (REQUIRED_BINARIES.every((b) => whichSync(b))) return [];
  const kegDir = homebrewKegBinDir();
  if (kegDir !== null) {
    return REQUIRED_BINARIES.filter((b) => !existsSync(join(kegDir, b)));
  }
  return REQUIRED_BINARIES.filter((b) => !whichSync(b));
}

function platformInstallHint(): string {
  if (isMacOS() && hasHomebrew()) {
    return [
      `Run \`brew install ${HOMEBREW_FORMULA}\`, then either add`,
      `  $(brew --prefix ${HOMEBREW_FORMULA})/bin to PATH`,
      `or set PG_BIN_DIR=$(brew --prefix ${HOMEBREW_FORMULA})/bin`,
      'so `pkgs/pg` can find the cluster tools.',
    ].join(' ');
  }
  if (isLinux()) {
    return [
      'Install via your package manager (Debian/Ubuntu: `sudo apt-get install -y postgresql`;',
      'Fedora/RHEL: `sudo dnf install -y postgresql-server`; Arch: `sudo pacman -S postgresql`)',
      'and ensure `postgres`, `pg_ctl`, `initdb`, `pg_isready` are on PATH',
      '(or set PG_BIN_DIR=/usr/lib/postgresql/<version>/bin).',
    ].join(' ');
  }
  return 'Install PostgreSQL and ensure `postgres`, `pg_ctl`, `initdb`, `pg_isready` are on PATH.';
}

export class PostgresDep implements Dep {
  readonly name = 'postgres';
  readonly bin = 'postgres';

  version(): string | null {
    const inPath = whichSync('postgres');
    if (inPath) return captureVersion('postgres', ['--version']);
    const kegDir = homebrewKegBinDir();
    if (kegDir !== null) {
      return captureVersion(join(kegDir, 'postgres'), ['--version']);
    }
    return null;
  }

  check(): DepStatus {
    const missing = missingBinaries();
    if (missing.length > 0) {
      return {
        ok: false,
        reason: `missing binaries: ${missing.join(', ')} — ${platformInstallHint()}`,
      };
    }
    const v = this.version();
    if (v === null) {
      return { ok: false, reason: 'could not determine version' };
    }
    return { ok: true, version: v };
  }

  // PostgreSQL upstream tags don't map cleanly onto our `semverCompare` (e.g.
  // `REL_17_6`); returning null tells `version-check` to warn-only on "latest"
  // resolution while still hard-failing on missing binaries.
  fetchLatestVersion(): Promise<string | null> {
    return Promise.resolve(null);
  }

  install(): void {
    if (isMacOS() && hasHomebrew()) {
      spawnInstall('brew', ['install', HOMEBREW_FORMULA]);
      return;
    }
    throw new Error(
      `Automatic PostgreSQL install requires Homebrew on macOS. ${platformInstallHint()}`
    );
  }

  upgrade(): void {
    if (isMacOS() && hasHomebrew()) {
      spawnInstall('brew', ['upgrade', HOMEBREW_FORMULA]);
      return;
    }
    this.install();
  }

  verify(): void {
    const canonical = findCanonicalBin();
    if (canonical === null) {
      throw new Error('postgres CLI not available after install');
    }
    verifyRun(canonical, ['--version']);
  }
}
